/**
 * StudioCanvas.tsx — v3
 *
 * Improvements:
 *  - CaptureBridge renders background color before capture (fixes transparent bg)
 *  - Exposes captureShot(azimuth, polar) for multi-angle capture
 *  - captureAllShots() rotates camera per shot, renders with bg, returns dataUrls
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

// ─── CaptureBridge ─────────────────────────────────────────────────────────



export interface CaptureAPI {
  capture: () => string;
  captureAt: (azimuth: number, polar: number, distance?: number) => Promise<string>;
}

/**
 * CaptureBridge — invisible R3F component that exposes a capture API.
 *
 * Uses THREE.Color for clear color so the canvas background is rendered
 * correctly in exported PNGs. The `background` prop should be the same
 * colour passed to the <Canvas> or scene background.
 */
export function CaptureBridge({
  onReady,
  background,
}: {
  onReady: (api: CaptureAPI) => void;
  background: string;
}) {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    const bgColor = new THREE.Color(background);

    const renderToDataUrl = (): string => {
      const prevClearColor = gl.getClearColor(new THREE.Color()).clone();
      const prevClearAlpha = gl.getClearAlpha();
      const prevAutoClear = gl.autoClear;

      gl.setClearColor(bgColor, 1);
      gl.autoClear = true;
      gl.render(scene, camera);

      const dataUrl = gl.domElement.toDataURL("image/png");

      gl.setClearColor(prevClearColor, prevClearAlpha);
      gl.autoClear = prevAutoClear;

      return dataUrl;
    };

    const captureAt = (
      azimuth: number,
      polar: number,
      distance?: number,
    ): Promise<string> =>
      new Promise((resolve) => {
        const savedPos = camera.position.clone();
        const savedQuat = camera.quaternion.clone();

        const radius = distance ?? (camera.position.length() || 5);

        camera.position.set(
          radius * Math.sin(polar) * Math.sin(azimuth),
          radius * Math.cos(polar),
          radius * Math.sin(polar) * Math.cos(azimuth),
        );
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        const prevClearColor = gl.getClearColor(new THREE.Color()).clone();
        const prevClearAlpha = gl.getClearAlpha();
        const prevAutoClear = gl.autoClear;

        gl.setClearColor(bgColor, 1);
        gl.autoClear = true;
        gl.render(scene, camera);

        const dataUrl = gl.domElement.toDataURL("image/png");

        gl.setClearColor(prevClearColor, prevClearAlpha);
        gl.autoClear = prevAutoClear;

        camera.position.copy(savedPos);
        camera.quaternion.copy(savedQuat);
        camera.updateProjectionMatrix();

        resolve(dataUrl);
      });

    onReady({
      capture: renderToDataUrl,
      captureAt,
    });
  }, [gl, scene, camera, onReady, background]);

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
