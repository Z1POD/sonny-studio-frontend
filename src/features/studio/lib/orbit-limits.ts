import type { CameraConfig, RotationConfig } from "../types";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * OrbitControls limits from the backend scene. Everything is optional: with no data this returns the controls'
 * own defaults (full vertical range, unlimited horizontal, speed 1), i.e. the behaviour before limits existed.
 */
export function orbitLimits(camera: CameraConfig, rotation?: RotationConfig) {
  const polarMin = clamp(rotation?.minPolarAngle ?? camera.minPolarAngle ?? 0, 0, Math.PI);
  const polarMax = clamp(rotation?.maxPolarAngle ?? camera.maxPolarAngle ?? Math.PI, 0, Math.PI);
  const [minPolarAngle, maxPolarAngle] = polarMin <= polarMax ? [polarMin, polarMax] : [polarMax, polarMin];
  // allow_360 === false with no explicit azimuth range keeps the product in the front half-turn.
  const restricted = rotation?.allow360 === false;
  const minAzimuthAngle = rotation?.minAzimuthAngle ?? (restricted ? -Math.PI / 2 : -Infinity);
  const maxAzimuthAngle = rotation?.maxAzimuthAngle ?? (restricted ? Math.PI / 2 : Infinity);
  return {
    minPolarAngle,
    maxPolarAngle,
    minAzimuthAngle,
    maxAzimuthAngle,
    rotateSpeed: rotation?.rotateSpeed && rotation.rotateSpeed > 0 ? rotation.rotateSpeed : 1,
  };
}
