// src/features/market/components/ProductViewer3D.tsx
//
// Read-only 3D preview for the product page. It renders the same way the studio does
// (shared <ProductModelView/>): the design's layers are projected onto the model, and the
// garment colour is recoloured live from the colour picker.

import { Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, useProgress } from "@react-three/drei";
import type { Viewer3D } from "@/features/studio/contract";
import { CanvasErrorBoundary } from "@/features/studio/components/CanvasErrorBoundary";
import { ProductModelView } from "@/features/studio/components/ProductModel";

interface Props {
  viewer: Viewer3D;
  /** Garment colour (hex) of the selected colour option. */
  colorHex: string;
  /** Called with true while the model/textures load and false once the first frame can show. */
  onLoadingChange?: (loading: boolean) => void;
  /** Model failed to load or WebGL was lost — the page falls back to photos. */
  onError?: () => void;
}

function LoadingBridge({ onLoadingChange }: { onLoadingChange?: (loading: boolean) => void }) {
  const { active, progress } = useProgress();
  useEffect(() => {
    onLoadingChange?.(active || progress < 100);
  }, [active, progress, onLoadingChange]);
  return null;
}

export function ProductViewer3D({ viewer, colorHex, onLoadingChange, onError }: Props) {
  const { light, camera, environment } = viewer;
  return (
    <CanvasErrorBoundary onError={onError}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: camera.position, fov: camera.fov, near: 0.05, far: 20 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => gl.domElement.addEventListener("webglcontextlost", () => onError?.())}
        className="touch-none"
        style={viewer.background ? { background: viewer.background } : undefined}
      >
        <ambientLight intensity={light.ambientIntensity} />
        <directionalLight position={light.key.position} intensity={light.key.intensity} castShadow />
        <directionalLight position={light.rim.position} intensity={light.rim.intensity} />
        <Suspense fallback={null}>
          <ProductModelView
            key={viewer.model.url}
            model={viewer.model}
            printZones={viewer.printZones}
            layers={viewer.layers}
            colorHex={colorHex}
            mode="preview"
          />
          <Environment environmentIntensity={environment.intensity}>
            <Lightformer intensity={2} position={[0, 5, 2]} scale={[10, 10, 1]} />
            <Lightformer intensity={1} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
            <Lightformer intensity={1} position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[20, 1, 1]} />
          </Environment>
        </Suspense>
        <ContactShadows
          position={[0, environment.contactShadow.y, 0]}
          opacity={environment.contactShadow.opacity}
          blur={environment.contactShadow.blur}
          scale={1.6}
          far={0.8}
        />
        <LoadingBridge onLoadingChange={onLoadingChange} />
        <OrbitControls
          target={camera.target}
          enablePan={false}
          minDistance={camera.minDistance}
          maxDistance={camera.maxDistance}
          enableDamping
          dampingFactor={0.08}
          autoRotate={environment.autoRotateInPreview}
          autoRotateSpeed={environment.autoRotateSpeed}
        />
      </Canvas>
    </CanvasErrorBoundary>
  );
}
