import { describe, expect, it } from "vitest";
import { orbitLimits } from "./orbit-limits";
import type { CameraConfig } from "../types";

const cam = { position: [0, 0, 1], fov: 30, target: [0, 0, 0], minDistance: 0.5, maxDistance: 2 } as CameraConfig;

describe("orbitLimits", () => {
  it("keeps the old behaviour without data", () => {
    expect(orbitLimits(cam)).toEqual({ minPolarAngle: 0, maxPolarAngle: Math.PI, minAzimuthAngle: -Infinity, maxAzimuthAngle: Infinity, rotateSpeed: 1 });
  });
  it("uses camera polar limits and rotation overrides", () => {
    expect(orbitLimits({ ...cam, minPolarAngle: 1.25, maxPolarAngle: 1.85 }).minPolarAngle).toBe(1.25);
    expect(orbitLimits({ ...cam, minPolarAngle: 1 }, { minPolarAngle: 1.3, maxPolarAngle: 1.8, rotateSpeed: 0.8 })).toMatchObject({ minPolarAngle: 1.3, maxPolarAngle: 1.8, rotateSpeed: 0.8 });
  });
  it("limits azimuth when 360° is off, unless a range is given", () => {
    expect(orbitLimits(cam, { allow360: false }).maxAzimuthAngle).toBeCloseTo(Math.PI / 2);
    expect(orbitLimits(cam, { allow360: false, minAzimuthAngle: -1, maxAzimuthAngle: 1 })).toMatchObject({ minAzimuthAngle: -1, maxAzimuthAngle: 1 });
    expect(orbitLimits(cam, { allow360: true }).maxAzimuthAngle).toBe(Infinity);
  });
  it("swaps inverted polar limits", () => {
    expect(orbitLimits(cam, { minPolarAngle: 2, maxPolarAngle: 1 })).toMatchObject({ minPolarAngle: 1, maxPolarAngle: 2 });
  });
});
