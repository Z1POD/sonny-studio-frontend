import * as THREE from "three";
import type { PrintZone, Vec3 } from "../types";

/**
 * Where the camera should sit to look straight at a print zone.
 *
 * The server sends `camera_position` per zone, but catalog data is often incomplete (every zone left at the
 * default front camera), which made the zone chips look dead: the active zone changed but the camera never moved.
 * So the server value is used only when it really faces the zone; otherwise it is derived from the zone's own
 * orientation (a decal projects along its local +Z, so we look down that axis from the home distance).
 */
export function zoneCameraPosition(zone: PrintZone, target: Vec3, home: Vec3): Vec3 {
  const t = new THREE.Vector3(...target);
  const dist = Math.max(0.5, new THREE.Vector3(...home).distanceTo(t));
  const normal = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(...zone.rotation)).normalize();
  const given = new THREE.Vector3(...zone.cameraPosition).sub(t);
  const identity = zone.rotation.every((r) => Math.abs(r) < 1e-3);
  // Catalog rows often leave every rotation at [0,0,0]; then what the zone is called / where it sits is the only hint.
  const hinted = zone.kind === "wrap" || !identity ? null : hintDirection(zone, target);
  if (hinted) {
    const p = t.add(hinted.multiplyScalar(dist));
    return [p.x, p.y, p.z];
  }
  const usable =
    given.length() > 0.3 && (zone.kind === "wrap" || given.clone().normalize().dot(normal) > 0.6);
  if (usable) return zone.cameraPosition;
  // A wrap covers the whole garment: a three-quarter front view shows most of it.
  const dir = zone.kind === "wrap" ? new THREE.Vector3(0.55, 0.12, 1).normalize() : normal;
  const p = t.add(dir.multiplyScalar(dist));
  return [p.x, p.y, p.z];
}

/** Direction implied by the zone's id/label (or its anchor offset), or null when it looks like the front. */
function hintDirection(zone: PrintZone, target: Vec3): THREE.Vector3 | null {
  const name = `${zone.code ?? ""} ${zone.id} ${zone.label}`.toLowerCase();
  if (/back|rear/.test(name)) return new THREE.Vector3(0, 0.05, -1).normalize();
  if (/left.*(sleeve|arm)|(sleeve|arm).*left|\bleft\b|sleeve_l|l_sleeve/.test(name)) return new THREE.Vector3(1, 0.1, 0).normalize();
  if (/right.*(sleeve|arm)|(sleeve|arm).*right|\bright\b|sleeve_r|r_sleeve/.test(name)) return new THREE.Vector3(-1, 0.1, 0).normalize();
  if (/sleeve/.test(name)) return new THREE.Vector3(1, 0.1, 0).normalize();
  const d = new THREE.Vector3(...zone.position).sub(new THREE.Vector3(...target));
  if (d.z < -0.05) return new THREE.Vector3(0, 0.05, -1).normalize();
  if (Math.abs(d.x) > 0.25 && Math.abs(d.x) > Math.abs(d.z)) return new THREE.Vector3(Math.sign(d.x), 0.1, 0).normalize();
  return null;
}
