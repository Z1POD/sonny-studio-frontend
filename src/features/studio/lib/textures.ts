import * as THREE from "three";
import type { ImageLayer, TextLayer } from "../types";

export interface LayerTexture {
  texture: THREE.Texture;
  aspect: number;
}

function finish(canvas: HTMLCanvasElement): LayerTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return { texture, aspect: canvas.width / canvas.height };
}

export function textTexture(layer: TextLayer): LayerTexture {
  const size = 220;
  const lines = (layer.text || " ").split("\n");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const font = `${layer.italic ? "italic " : ""}${layer.fontWeight} ${size}px ${layer.fontFamily}`;
  ctx.font = font;
  const spacing = layer.letterSpacing * size * 0.01;
  const measure = (s: string) => ctx.measureText(s).width + spacing * Math.max(0, s.length - 1);
  const width = Math.max(...lines.map(measure), size * 0.5);
  const lineH = size * 1.18;
  const pad = size * 0.2;
  canvas.width = Math.ceil(width + pad * 2);
  canvas.height = Math.ceil(lineH * lines.length + pad);
  ctx.font = font;
  ctx.fillStyle = layer.color;
  ctx.textBaseline = "middle";
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${spacing}px`;
  lines.forEach((line, i) => {
    const w = measure(line);
    const x = layer.align === "left" ? pad : layer.align === "right" ? canvas.width - pad - w : (canvas.width - w) / 2;
    ctx.fillText(line, x, pad / 2 + lineH * (i + 0.5));
  });
  return finish(canvas);
}

export function imageTexture(layer: ImageLayer): Promise<LayerTexture> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const max = 1024;
      const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1);
      const canvas = document.createElement("canvas");
      canvas.width = ratio >= 1 ? max : Math.round(max * ratio);
      canvas.height = ratio >= 1 ? Math.round(max / ratio) : max;
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(finish(canvas));
    };
    img.onerror = reject;
    img.src = layer.src;
  });
}

export function zoneGuideTexture(): LayerTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 500;
  const ctx = canvas.getContext("2d")!;
  ctx.strokeStyle = "rgba(10,132,255,0.9)";
  ctx.lineWidth = 6;
  ctx.setLineDash([22, 16]);
  ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
  return finish(canvas);
}

/* ── Full-wrap compositor (UV space) ─────────────────────────────────── */

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string) {
  let p = imageCache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    imageCache.set(src, p);
  }
  return p;
}

/**
 * Paints all full-wrap layers onto a square UV canvas.
 * Layer x/y map to UV space (-1..1, y up), scale is a fraction of canvas height.
 */
export async function drawWrap(
  canvas: HTMLCanvasElement,
  layers: (TextLayer | ImageLayer)[],
  baseHex: string,
) {
  const S = canvas.width;
  const sources = await Promise.all(
    layers.map(async (l) => {
      if (l.kind === "text") return textTexture(l).texture.image as HTMLCanvasElement;
      try {
        return await loadImage(l.src);
      } catch {
        return null;
      }
    }),
  );
  const ctx = canvas.getContext("2d")!;
  ctx.globalAlpha = 1;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, S, S);
  layers.forEach((l, i) => {
    const src = sources[i];
    if (!src || !l.visible) return;
    const w0 = (src as HTMLImageElement).naturalWidth || src.width;
    const h0 = (src as HTMLImageElement).naturalHeight || src.height;
    const h = l.transform.scale * S;
    const w = h * (w0 / h0);
    ctx.save();
    ctx.globalAlpha = l.transform.opacity;
    ctx.translate(S / 2 + (l.transform.x * S) / 2, S / 2 - (l.transform.y * S) / 2);
    ctx.rotate((l.transform.rotation * Math.PI) / 180);
    ctx.drawImage(src, -w / 2, -h / 2, w, h);
    ctx.restore();
  });
  return sources;
}
