import * as THREE from "three";
import type { Layer } from "../types";

const masks = new WeakMap<object, { width: number; height: number; data: Uint8ClampedArray }>();

export function sourceHasInk(source: HTMLCanvasElement | HTMLImageElement, x: number, y: number) {
  if (x < 0 || y < 0 || x >= 1 || y >= 1) return false;
  let mask = masks.get(source);
  if (!mask) {
    const canvas = document.createElement("canvas");
    canvas.width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    canvas.height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || !canvas.width || !canvas.height) return false;
    try {
      ctx.drawImage(source, 0, 0);
      mask = { width: canvas.width, height: canvas.height, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data };
      masks.set(source, mask);
    } catch { return false; }
  }
  return (mask.data[(Math.floor(y * mask.height) * mask.width + Math.floor(x * mask.width)) * 4 + 3] ?? 0) > 8;
}

export function textureHasInk(texture: THREE.Texture, uv: THREE.Vector2) {
  const image = texture.image;
  if (!(image instanceof HTMLCanvasElement) && !(image instanceof HTMLImageElement)) return false;
  const point = uv.clone();
  texture.transformUv(point);
  return sourceHasInk(image, point.x, point.y);
}

export function wrapLayerPoint(layer: Layer, uv: { x: number; y: number }, aspect: number) {
  const t = layer.transform;
  const dx = uv.x - (0.5 + t.x / 2);
  const dy = uv.y - (0.5 - t.y / 2);
  const a = t.rotation * Math.PI / 180;
  return { x: (dx * Math.cos(a) + dy * Math.sin(a)) / (t.scale * aspect) + 0.5,
    y: (-dx * Math.sin(a) + dy * Math.cos(a)) / t.scale + 0.5 };
} 