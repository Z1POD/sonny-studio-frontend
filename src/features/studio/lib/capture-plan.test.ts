import { describe, expect, it } from "vitest";
import { planMockupShots } from "./capture-plan";
import type { Layer, ProductConfig } from "../types";

const z = (id: string, rotation: [number, number, number]) => ({
  id, label: id, kind: "decal", position: [0, 0, 0.15], rotation, size: [0.2, 0.2], printAreaCm: [30, 40],
  cameraPosition: [0, 0.05, 1.7], allowedMethods: [],
});
const product = {
  camera: { target: [0, 0, 0], position: [0, 0.05, 1.7] },
  capture: { shots: [{ angle: "front", position: [0, 0.05, 1.6] }] },
  printZones: [z("front", [0, 0, 0]), z("back", [0, Math.PI, 0]), z("sleeve", [0, Math.PI / 2, 0])],
} as unknown as ProductConfig;
const layer = (zoneId: string, visible = true) => ({ id: zoneId, zoneId, visible }) as Layer;

describe("planMockupShots", () => {
  it("captures only printed zones plus a detail shot", () => {
    expect(planMockupShots(product, [layer("front")]).map((s) => s.angle)).toEqual(["front", "detail"]);
  });
  it("puts front first and skips hidden layers", () => {
    expect(planMockupShots(product, [layer("back"), layer("front"), layer("sleeve", false)]).map((s) => s.angle)).toEqual(["front", "back", "detail"]);
  });
  it("back-only design starts with the back", () => {
    const [first, detail] = planMockupShots(product, [layer("back")]);
    expect(first!.angle).toBe("back");
    expect(first!.position[2]).toBeLessThan(-1);
    expect(detail!.position[2]).toBeLessThan(-0.5);
  });
});
