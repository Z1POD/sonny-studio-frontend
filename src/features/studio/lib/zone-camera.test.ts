import { describe, expect, it } from "vitest";
import { zoneCameraPosition } from "./zone-camera";
import type { PrintZone } from "../types";

const target: [number, number, number] = [0, 0, 0];
const home: [number, number, number] = [0, 0.05, 1.7];
const zone = (over: Partial<PrintZone>): PrintZone => ({
  id: "z", label: "Z", kind: "decal", position: [0, 0, 0.15], rotation: [0, 0, 0], size: [0.24, 0.3],
  printAreaCm: [30, 40], cameraPosition: [0, 0.05, 1.7], allowedMethods: [], ...over,
} as PrintZone);

describe("zoneCameraPosition", () => {
  it("keeps a server camera that faces the zone", () => {
    expect(zoneCameraPosition(zone({ rotation: [0, Math.PI, 0], cameraPosition: [0, 0.05, -1.7] }), target, home)).toEqual([0, 0.05, -1.7]);
  });
  it("derives the back view when the server left the front camera on a back-facing zone", () => {
    const [x, , z] = zoneCameraPosition(zone({ rotation: [0, Math.PI, 0] }), target, home);
    expect(z).toBeLessThan(-1.5);
    expect(Math.abs(x)).toBeLessThan(0.01);
  });
  it("derives a side view for a sleeve", () => {
    const [x, , z] = zoneCameraPosition(zone({ rotation: [0, Math.PI / 2, 0] }), target, home);
    expect(x).toBeGreaterThan(1.5);
    expect(Math.abs(z)).toBeLessThan(0.1);
  });
  it("falls back when the server sends [0,0,0]", () => {
    const p = zoneCameraPosition(zone({ cameraPosition: [0, 0, 0] }), target, home);
    expect(p[2]).toBeGreaterThan(1.5);
  });
  it("uses a three-quarter front view for wraps without a usable camera", () => {
    const [x, , z] = zoneCameraPosition(zone({ kind: "wrap", cameraPosition: [0, 0, 0] }), target, home);
    expect(x).toBeGreaterThan(0.3);
    expect(z).toBeGreaterThan(1);
  });
  it("uses the zone name when every rotation is [0,0,0]", () => {
    expect(zoneCameraPosition(zone({ id: "back", label: "Back" }), target, home)[2]).toBeLessThan(-1.5);
    expect(zoneCameraPosition(zone({ id: "sleeve_l", label: "Left sleeve" }), target, home)[0]).toBeGreaterThan(1.5);
    expect(zoneCameraPosition(zone({ id: "sleeve_r", label: "Right sleeve" }), target, home)[0]).toBeLessThan(-1.5);
    expect(zoneCameraPosition(zone({ id: "front", label: "Front" }), target, home)[2]).toBeGreaterThan(1.5);
  });
});

describe("zone codes", () => {
  it("uses the code when the id is a UUID", () => {
    const back = zoneCameraPosition(zone({ id: "da96e664-7bb7-4550-bdb7-9807351e761e", code: "back", label: "Panel" }), target, home);
    expect(back[2]).toBeLessThan(-1.5);
  });
});
