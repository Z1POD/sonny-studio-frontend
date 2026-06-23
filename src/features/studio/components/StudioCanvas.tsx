/**
 * StudioCanvas.tsx — v4
 *
 * Improvements:
 *  - CaptureBridge renders background color before capture (fixes transparent bg)
 *  - Exposes captureShot(azimuth, polar) for multi-angle capture
 *  - captureAllShots() rotates camera per shot, renders with bg, returns dataUrls
 *  - All captures (capture + captureAt) always output at CAPTURE_WIDTH×CAPTURE_HEIGHT
 *    (default 1920×1080, 16:9) regardless of the live canvas size/aspect ratio.
 *    The renderer is temporarily resized, the camera aspect is adjusted, a single
 *    off-screen render is fired, then everything is restored — the live canvas is
 *    unaffected and no visual glitch occurs.
 */

import { Canvas, useThree } from "@react-three/fiber";
import {
  Suspense,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import {
  ContactShadows,
  Environment,
  OrbitControls,
} from "@react-three/drei";
import * as THREE from "three";
import { useStudioStore } from "../store";
import { ProductModel } from "./ProductModel";
// import { DecalGizmo } from "./DecalGizmo";
import type { ShotConfig } from "./SaveProductDialog";

// ─── CaptureAPI ────────────────────────────────────────────────────────────

export interface CaptureAPI {
  capture: () => string;
  captureAt: (azimuth: number, polar: number, distance?: number) => Promise<string>;
}

// ─── Capture resolution ────────────────────────────────────────────────────
// All exported images are always this size, regardless of the live canvas.

const CAPTURE_WIDTH = 1920;
const CAPTURE_HEIGHT = 1080; // 16:9

// ─── CaptureBridge ─────────────────────────────────────────────────────────

export function CaptureBridge({
  onReady,
  background,
  modelPosition = [0, 0, 0],
  captureDistance,
  captureDistanceScale = 1,
  captureLookAtOffset = [0, 0, 0],
}: {
  onReady: (api: CaptureAPI) => void;
  background: string;
  modelPosition?: [number, number, number];
  /** Fixed orbit radius for all captureAt calls — immune to user zoom. */
  captureDistance?: number;
  /** Multiplier applied to captureDistance. <1 = closer, >1 = further. Default 1. */
  captureDistanceScale?: number;
  /** XYZ offset applied to the lookAt target. e.g. [0, -0.1, 0] tilts camera slightly down. */
  captureLookAtOffset?: [number, number, number];
}) {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    const bgColor = new THREE.Color(background);
    const modelTarget = new THREE.Vector3(...modelPosition);
    const captureTarget = modelTarget.clone().add(new THREE.Vector3(...captureLookAtOffset));

    /**
     * Temporarily resize the renderer + camera to CAPTURE_WIDTH × CAPTURE_HEIGHT,
     * call `fn`, then restore everything. Returns whatever `fn` returns.
     *
     * Using `gl.setSize(..., false)` keeps the CSS size of the DOM element
     * unchanged so the live canvas never flickers.
     */
    const withCaptureSize = <T,>(fn: () => T): T => {
      // Save renderer state
      const prevSize = gl.getSize(new THREE.Vector2());
      const prevPixelRatio = gl.getPixelRatio();
      const prevClearColor = gl.getClearColor(new THREE.Color()).clone();
      const prevClearAlpha = gl.getClearAlpha();
      const prevAutoClear = gl.autoClear;

      // Save camera aspect (only meaningful for PerspectiveCamera)
      const perspCam = camera instanceof THREE.PerspectiveCamera ? camera : null;
      const prevAspect = perspCam?.aspect;

      // ── Resize to capture resolution ──
      // Third arg `false` = don't update the canvas CSS size (no visual flicker)
      gl.setPixelRatio(1); // 1:1 so domElement pixels == CAPTURE dimensions exactly
      gl.setSize(CAPTURE_WIDTH, CAPTURE_HEIGHT, false);

      if (perspCam) {
        perspCam.aspect = CAPTURE_WIDTH / CAPTURE_HEIGHT;
        perspCam.updateProjectionMatrix();
      }

      gl.setClearColor(bgColor, 1);
      gl.autoClear = true;

      // ── Render & capture ──
      const result = fn();

      // ── Restore everything ──
      gl.setPixelRatio(prevPixelRatio);
      gl.setSize(prevSize.width, prevSize.height, false);

      if (perspCam && prevAspect !== undefined) {
        perspCam.aspect = prevAspect;
        perspCam.updateProjectionMatrix();
      }

      gl.setClearColor(prevClearColor, prevClearAlpha);
      gl.autoClear = prevAutoClear;

      return result;
    };

    const renderToDataUrl = (): string =>
      withCaptureSize(() => {
        gl.render(scene, camera);
        return gl.domElement.toDataURL("image/png");
      });

    const captureAt = (
      azimuth: number,
      polar: number,
      distance?: number,
    ): Promise<string> =>
      new Promise((resolve) => {
        const savedPos = camera.position.clone();
        const savedQuat = camera.quaternion.clone();

        // Orbit radius: explicit arg > fixed design distance > live camera distance
        // captureDistance is derived from cam.position so it never changes with user zoom.
        const radius = (distance ?? captureDistance ?? (camera.position.distanceTo(captureTarget) || 5)) * captureDistanceScale;

        console.log("[CaptureBridge] captureAt", {
          azimuth,
          polar,
          captureDistance,
          captureDistanceScale,
          captureLookAtOffset,
          radius,
          captureTarget: captureTarget.toArray(),
          cameraPosition: [
            +(captureTarget.x + radius * Math.sin(polar) * Math.sin(azimuth)).toFixed(3),
            +(captureTarget.y + radius * Math.cos(polar)).toFixed(3),
            +(captureTarget.z + radius * Math.sin(polar) * Math.cos(azimuth)).toFixed(3),
          ],
          outputSize: `${CAPTURE_WIDTH}x${CAPTURE_HEIGHT}`,
        });

        // Position camera on the sphere centred on captureTarget
        camera.position.set(
          captureTarget.x + radius * Math.sin(polar) * Math.sin(azimuth),
          captureTarget.y + radius * Math.cos(polar),
          captureTarget.z + radius * Math.sin(polar) * Math.cos(azimuth),
        );
        camera.lookAt(captureTarget);

        const dataUrl = withCaptureSize(() => {
          gl.render(scene, camera);
          return gl.domElement.toDataURL("image/png");
        });

        // Restore camera position
        camera.position.copy(savedPos);
        camera.quaternion.copy(savedQuat);
        // Aspect was already restored inside withCaptureSize, just sync matrices
        camera.updateProjectionMatrix();

        resolve(dataUrl);
      });

    onReady({
      capture: renderToDataUrl,
      captureAt,
    });
  }, [gl, scene, camera, onReady, background, modelPosition, captureDistance, captureDistanceScale, captureLookAtOffset]);

  return null;
}


// ─── Lights ────────────────────────────────────────────────────────────────

interface LightConfig {
  ambient?: number;
  key?: { position: [number, number, number]; intensity: number };
  fill?: { position: [number, number, number]; intensity: number };
  rim?: { position: [number, number, number]; intensity: number };
}

function Lights({ lighting }: { lighting?: LightConfig }) {
  if (!lighting) {
    return (
      <>
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[3, 5, 3]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0001}
        />
        <directionalLight
          position={[-2, 3, 2]}
          intensity={0.6}
          color="#7aa2ff"
        />
      </>
    );
  }
  return (
    <>
      <ambientLight intensity={lighting.ambient ?? 0.5} />
      {lighting.key && (
        <directionalLight
          position={lighting.key.position}
          intensity={lighting.key.intensity}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0001}
        />
      )}
      {lighting.fill && (
        <directionalLight
          position={lighting.fill.position}
          intensity={lighting.fill.intensity}
          color="#7aa2ff"
        />
      )}
      {lighting.rim && (
        <spotLight
          position={lighting.rim.position}
          intensity={lighting.rim.intensity}
          angle={0.3}
          penumbra={1}
          castShadow
        />
      )}
    </>
  );
}

// ─── StudioCanvas handle ───────────────────────────────────────────────────

export interface StudioCanvasHandle {
  capture: () => string | null;
  captureAllShots: (shots: ShotConfig[]) => Promise<ShotConfig[]>;
}

export const StudioCanvas = forwardRef<StudioCanvasHandle>(
  function StudioCanvas(_, ref) {
    const store = useStudioStore();
    const product = store.product;
    const captureApiRef = useRef<CaptureAPI | null>(null);

    useImperativeHandle(ref, () => ({
      capture: () => captureApiRef.current?.capture() ?? null,
      captureAllShots: async (shots: ShotConfig[]): Promise<ShotConfig[]> => {
        const api = captureApiRef.current;
        if (!api) return shots;
        const result: ShotConfig[] = [];
        for (const shot of shots) {
          if (!shot.enabled) { result.push(shot); continue; }
          const dataUrl = await api.captureAt(shot.azimuth, shot.polar);
          result.push({ ...shot, dataUrl });
        }
        return result;
      },
    }));

    if (!product) {
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Loading product…
        </div>
      );
    }

    const render = product.renderConfig;
    const cam = product.cameraConfig;
    const orbit = cam.orbit;
    const shadows = render.contactShadows;

    return (
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: cam.position, fov: cam.fov }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        style={{ background: render.background }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <CaptureBridge
          onReady={(api) => (captureApiRef.current = api)}
          background={render.background}
          modelPosition={render.modelPosition}
          captureDistance={new THREE.Vector3(...cam.position).distanceTo(new THREE.Vector3(...render.modelPosition))}
          captureDistanceScale={cam.captureDistanceScale ?? 0.42}
          captureLookAtOffset={cam.captureLookAtOffset ?? [0, -0.08, 0]}
        />

        <Suspense fallback={null}>
          <Environment preset={product.environment} />
          <Lights lighting={(render as any).lighting} />

          <group position={render.modelPosition}>
            <ProductModel
              modelUrl={product.modelUrl}
              printAreas={product.printAreas}
              artworks={store.artworks}
              selectedColor={store.selectedColor}
              colorableMeshes={product.colorableMeshes}
              materialConfig={product.materialConfig}
            />
            {/* DecalGizmo removed — manipulation now via sliders in DecalPanel */}
          </group>

          {shadows.enabled && (
            <ContactShadows
              position={shadows.position}
              opacity={shadows.opacity}
              scale={shadows.scale}
              blur={shadows.blur}
              far={shadows.far}
            />
          )}
        </Suspense>

        <OrbitControls
          makeDefault
          enablePan={orbit.enablePan}
          enableZoom={orbit.enableZoom}
          autoRotate={store.autoRotate}
          autoRotateSpeed={1.2}
          minDistance={orbit.minDistance}
          maxDistance={orbit.maxDistance}
          minPolarAngle={orbit.minPolarAngle}
          maxPolarAngle={orbit.maxPolarAngle}
          enableDamping
          dampingFactor={0.06}
        />
      </Canvas>
    );
  },
);