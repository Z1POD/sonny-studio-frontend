// src/features/studio/components/CaptureBridge.tsx

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

export interface CaptureAPI {
  capture: () => string;
  captureAt: (azimuth: number, polar: number, distance?: number) => Promise<string>;
}

const CAPTURE_WIDTH = 2560;
const CAPTURE_HEIGHT = 1440;

interface CaptureBridgeProps {
  onReady: (api: CaptureAPI) => void;
  background: string;
  modelPosition?: [number, number, number];
  captureDistance?: number;
  captureDistanceScale?: number;
  captureLookAtOffset?: [number, number, number];
}

export function CaptureBridge({
  onReady,
  background,
  modelPosition = [0, 0, 0],
  captureDistance,
  captureDistanceScale = 1,
  captureLookAtOffset = [0, 0, 0],
}: CaptureBridgeProps) {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    const bgColor = new THREE.Color(background);
    const modelTarget = new THREE.Vector3(...modelPosition);
    const captureTarget = modelTarget.clone().add(new THREE.Vector3(...captureLookAtOffset));

    const withCaptureSize = <T,>(fn: () => T): T => {
      const prevSize = gl.getSize(new THREE.Vector2());
      const prevPixelRatio = gl.getPixelRatio();
      const prevClearColor = gl.getClearColor(new THREE.Color()).clone();
      const prevClearAlpha = gl.getClearAlpha();
      const prevAutoClear = gl.autoClear;

      const perspCam = camera instanceof THREE.PerspectiveCamera ? camera : null;
      const prevAspect = perspCam?.aspect;

      gl.setPixelRatio(1);
      gl.setSize(CAPTURE_WIDTH, CAPTURE_HEIGHT, false);

      if (perspCam) {
        perspCam.aspect = CAPTURE_WIDTH / CAPTURE_HEIGHT;
        perspCam.updateProjectionMatrix();
      }

      gl.setClearColor(bgColor, 1);
      gl.autoClear = true;

      const result = fn();

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

        const radius = (distance ?? captureDistance ?? (camera.position.distanceTo(captureTarget) || 5)) * captureDistanceScale;

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

        camera.position.copy(savedPos);
        camera.quaternion.copy(savedQuat);
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