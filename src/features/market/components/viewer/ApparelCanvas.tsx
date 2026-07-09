// src/features/market/components/viewer/ApparelCanvas.tsx
//
// Marketplace's read-only 3D preview canvas — deliberately built from the
// same building blocks as Studio's StudioCanvas (Lights, CanvasErrorBoundary,
// ProgressReporter) instead of a parallel re-implementation, so the two
// surfaces render identically. See ApparelMesh.tsx for the equivalent on
// the mesh/material/decal side.
//
// Camera/orbit/contact-shadow numbers still come from `viewer.*` (the
// marketplace API's own render config) rather than being hardcoded to
// Studio's defaults, since a marketplace product's camera framing is
// legitimately per-product. What's now shared is the *rendering machinery*
// (lighting rig, error handling, loading UI, damping feel) — not every
// individual number.

import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls } from "@react-three/drei";
import { Loader2 } from "lucide-react";
import type { ColorVariant, Viewer3D } from "../../api";
import { ApparelMesh } from "./ApparelMesh";
import { Lights } from "@/features/studio/components/Lights";
import { ProgressReporter } from "@/features/studio/components/ProgressReporter";
import { CanvasErrorBoundary } from "@/features/studio/components/CanvasErrorBoundary";

interface Props {
  color: ColorVariant;
  viewer: Viewer3D;
  onLoadingChange?: (loading: boolean, progress: number) => void;
  onError?: () => void;
}

export function ApparelCanvas({ color, viewer, onLoadingChange, onError }: Props) {
  const cam = viewer.camera;
  const orbit = cam?.orbit;
  const hasContactShadows = viewer.contact_shadows?.enabled ?? true;
  const [modelLoading, setModelLoading] = useState(true);

  if (!viewer.model_url) return null;

  return (
    <CanvasErrorBoundary onError={onError}>
      <div className="relative h-full w-full">
        {modelLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 backdrop-blur-md">
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-medium">Loading model...</p>
            </div>
          </div>
        )}

        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: cam?.position ?? [0, 0.2, 6], fov: cam?.fov ?? 35 }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener("webglcontextlost", () => {
              onError?.();
            });
          }}
          gl={{ antialias: true, alpha: true }}
          className="touch-none"
          style={viewer.background ? { background: viewer.background } : undefined}
        >
          <Suspense fallback={null}>
            <ProgressReporter
              onLoadingChange={(loading, progress) => {
                setModelLoading(loading);
                onLoadingChange?.(loading, progress);
              }}
            />
            {viewer.environment && <Environment preset={viewer.environment as any} />}
            <Lights lighting={viewer.lighting} />
            <ApparelMesh
              modelUrl={viewer.model_url}
              colorHex={color.hex}
              material={viewer.material}
              modelPosition={viewer.model_position}
              colorableMeshes={viewer.colorable_meshes}
              printAreas={viewer.print_areas}
            />
          </Suspense>

          {hasContactShadows && (
            <ContactShadows
              position={viewer.contact_shadows?.position ?? [0, -1.9, 0]}
              opacity={viewer.contact_shadows?.opacity ?? 0.45}
              scale={viewer.contact_shadows?.scale ?? 8}
              blur={viewer.contact_shadows?.blur ?? 2.4}
              far={viewer.contact_shadows?.far ?? 3}
            />
          )}

          <OrbitControls
            enablePan={orbit?.enable_pan ?? false}
            enableZoom={orbit?.enable_zoom ?? true}
            minDistance={orbit?.min_distance ?? 4}
            maxDistance={orbit?.max_distance ?? 9}
            enableDamping
            dampingFactor={0.06}
            minPolarAngle={orbit?.min_polar_angle ?? Math.PI / 3}
            maxPolarAngle={orbit?.max_polar_angle ?? Math.PI / 1.6}
          />
        </Canvas>
      </div>
    </CanvasErrorBoundary>
  );
}