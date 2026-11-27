import type { CaptureAngle, MockupCapture, Vec3 } from "../types";

export interface CaptureRequest { angle: CaptureAngle; position: Vec3 }
type CaptureFn = (shots: CaptureRequest[]) => Promise<MockupCapture[]>;

let registered: CaptureFn | null = null;

export function registerCapture(fn: CaptureFn | null) {
  registered = fn;
}

/** Captures the given camera shots (selection frame and handles are hidden while rendering). */
export function captureMockups(shots: CaptureRequest[]) {
  if (!registered) return Promise.reject(new Error("Canvas not ready"));
  return registered(shots);
}
