// src/features/studio/components/StudioCanvas.tsx


import React, {
  Suspense,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import { useStudioStore } from "../store";
import { ProductModel } from "./ProductModel";
import { CaptureBridge, type CaptureAPI } from "./CaptureBridge";
import { Lights } from "./Lights";
import { ProgressReporter } from "./ProgressReporter";
import { CanvasErrorBoundary } from "./CanvasErrorBoundary";

export interface ShotConfig {
  id: string;
  label: string;
  azimuth: number;
  polar: number;
  enabled: boolean;
  dataUrl?: string;
}

export interface StudioCanvasHandle {
  capture: () => string | null;
  captureAllShots: (shots: ShotConfig[]) => Promise<ShotConfig[]>;
}

export const StudioCanvas = forwardRef<StudioCanvasHandle>(
  function StudioCanvas(_, ref) {
    const store = useStudioStore();
    const product = store.product;
    const captureApiRef = useRef<CaptureAPI | null>(null);

    const [modelLoading, setModelLoading] = useState(true);
    const [modelProgress, setModelProgress] = useState(0);

    useImperativeHandle(ref, () => ({
      capture: () => captureApiRef.current?.capture() ?? null,
      captureAllShots: async (shots: ShotConfig[]): Promise<ShotConfig[]> => {
        const api = captureApiRef.current;
        if (!api) return shots;
        const result: ShotConfig[] = [];
        for (const shot of shots) {
          if (!shot.enabled) {
            result.push(shot);
            continue;
          }
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
      <CanvasErrorBoundary>
        <div className="relative h-full w-full">
          {modelLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 backdrop-blur-md">
              <div className="w-48 space-y-3 text-center">
                <p className="text-sm font-medium">Loading model...</p>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${modelProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {Math.round(modelProgress)}%
                </p>
              </div>
            </div>
          )}
          
          <Canvas
            shadows
            dpr={[1, 2]}
            camera={{ position: cam.position, fov: cam.fov }}
            gl={{
              preserveDrawingBuffer: true,
              antialias: true,
              powerPreference: "high-performance",
            }}
            style={{ background: render.background }}
          >
            <CaptureBridge
              onReady={(api) => (captureApiRef.current = api)}
              background={render.background}
              modelPosition={render.modelPosition}
              captureDistance={new THREE.Vector3(...cam.position).distanceTo(
                new THREE.Vector3(...render.modelPosition)
              )}
              captureDistanceScale={cam.captureDistanceScale ?? 0.42}
              captureLookAtOffset={cam.captureLookAtOffset ?? [0, -0.08, 0]}
            />

            <Suspense fallback={null}>
              <ProgressReporter
                onLoadingChange={(loading, progress) => {
                  setModelLoading(loading);
                  setModelProgress(progress);
                }}
              />
              <Environment preset={product.environment} />
              <Lights lighting={(render as any).lighting} />

              <group position={render.modelPosition}>
                <ProductModel
                  modelUrl={product.modelUrl}
                  printAreas={product.printAreas}
                  artworks={store.artworks}
                  layerOrder={store.layerOrder}
                  selectedColor={store.selectedColor}
                  colorableMeshes={product.colorableMeshes}
                  materialConfig={product.materialConfig}
                />
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
        </div>
      </CanvasErrorBoundary>
    );
  }
);