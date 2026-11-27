import * as THREE from "three";
import type { CaptureAngle, Layer, ProductConfig, Vec3 } from "../types";
import type { CaptureRequest } from "./capture";
import { zoneCameraPosition } from "./zone-camera";

/** Which of the named mockup angles a camera position (relative to the model target) looks from. */
export function angleOf(pos: Vec3, target: Vec3): Exclude<CaptureAngle, "detail"> {
  const x = pos[0] - target[0];
  const z = pos[2] - target[2];
  if (Math.abs(x) > Math.abs(z)) return x > 0 ? "left" : "right";
  return z >= 0 ? "front" : "back";
}

/**
 * Mockup shots for a design: only print zones that actually carry visible artwork are captured (one angle per
 * zone, front first), plus a close "detail" shot of the first printed zone. Nothing is captured for empty zones.
 */
export function planMockupShots(product: ProductConfig, layers: Layer[]): CaptureRequest[] {
  const target = product.camera.target;
  const home = product.camera.position;
  const printedIds = new Set(layers.filter((l) => l.visible).map((l) => l.zoneId));
  const zones = product.printZones.filter((z) => printedIds.has(z.id));
  if (zones.length === 0) {
    const front = product.capture.shots.find((s) => s.angle === "front") ?? product.capture.shots[0];
    return front ? [{ angle: front.angle, position: front.position }] : [];
  }
  const t = new THREE.Vector3(...target);
  const out: CaptureRequest[] = [];
  const seen = new Set<string>();
  for (const z of zones) {
    const position = zoneCameraPosition(z, target, home);
    const angle = z.kind === "wrap" ? "front" : angleOf(position, target);
    if (seen.has(angle)) continue;
    seen.add(angle);
    out.push({ angle, position });
  }
  out.sort((a, b) => (a.angle === "front" ? -1 : 0) - (b.angle === "front" ? -1 : 0));
  // Close-up of the first printed zone.
  const first = out[0]!;
  const dir = new THREE.Vector3(...first.position).sub(t);
  const close = t.clone().add(dir.setLength(Math.max(0.6, dir.length() * 0.5)));
  out.push({ angle: "detail", position: [close.x, close.y + 0.05, close.z] });
  return out;
}
