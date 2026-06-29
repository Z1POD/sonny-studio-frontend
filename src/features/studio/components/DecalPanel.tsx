// src/features/studio/components/DecalPanel.tsx
/**
 * DecalPanel.tsx — v2
 *
 * Gizmo-style artwork manipulation:
 * - 2-finger/wheel: scale
 * - Single drag: translate X/Y
 * - Rotation dial: arc gesture or tap buttons
 * - Compact sliders hidden behind "Fine-tune" toggle for precise control
 * - Retains upload / remove actions
 */

import { useRef, useMemo, useCallback, useState, useEffect } from "react";
import { Image as ImageIcon, Trash2, RotateCw, ZoomIn, ZoomOut, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useStudioStore, getDefaultArtwork } from "../store";

// ── Gizmo canvas ───────────────────────────────────────────────────────────

interface GizmoProps {
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
  aspect: number;
  decalUrl: string;
  minScale: number;
  maxScale: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  onChange: (patch: { offsetX?: number; offsetY?: number; scale?: number; rotation?: number }) => void;
}

function DecalGizmo({
  offsetX, offsetY, scale, rotation, aspect, decalUrl,
  minScale, maxScale, minX, maxX, minY, maxY,
  onChange,
}: GizmoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);

  // Canvas → world scale: map px movements to world units
  const CANVAS_W = 280;
  const CANVAS_H = 200;
  const worldRangeX = maxX - minX;
  const worldRangeY = maxY - minY;
  const pxPerUnitX = CANVAS_W / worldRangeX;
  const pxPerUnitY = CANVAS_H / worldRangeY;

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  // Mouse / touch drag → translate
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "touch") return; // handled by touch events
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [offsetX, offsetY]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = (e.clientX - dragStart.current.x) / pxPerUnitX;
    const dy = (e.clientY - dragStart.current.y) / pxPerUnitY;
    onChange({
      offsetX: clamp(dragStart.current.ox + dx, minX, maxX),
      offsetY: clamp(dragStart.current.oy + dy, minY, maxY),
    });
  }, [pxPerUnitX, pxPerUnitY, minX, maxX, minY, maxY, onChange]);

  const onPointerUp = useCallback(() => { dragStart.current = null; }, []);

  // Touch: single drag + pinch scale
  const getTouchDist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const touchStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, ox: offsetX, oy: offsetY };
    } else if (e.touches.length === 2) {
      pinchStart.current = { dist: getTouchDist(e.touches), scale };
      touchStart.current = null;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && touchStart.current) {
      const dx = (e.touches[0].clientX - touchStart.current.x) / pxPerUnitX;
      const dy = (e.touches[0].clientY - touchStart.current.y) / pxPerUnitY;
      onChange({
        offsetX: clamp(touchStart.current.ox + dx, minX, maxX),
        offsetY: clamp(touchStart.current.oy + dy, minY, maxY),
      });
    } else if (e.touches.length === 2 && pinchStart.current) {
      const ratio = getTouchDist(e.touches) / pinchStart.current.dist;
      onChange({ scale: clamp(pinchStart.current.scale * ratio, minScale, maxScale) });
    }
  };

  const onTouchEnd = () => { touchStart.current = null; pinchStart.current = null; };

  // Scroll → scale
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    onChange({ scale: clamp(scale + delta * (maxScale - minScale), minScale, maxScale) });
  };

  // Preview positioning: map world units to % within canvas
  const px = ((offsetX - minX) / worldRangeX) * 100;
  const py = ((offsetY - minY) / worldRangeY) * 100;
  const previewSize = (scale / maxScale) * 80 + 10; // 10–90% of canvas width

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
      className="relative select-none overflow-hidden rounded-2xl border border-border/50 bg-surface/60 touch-none cursor-grab active:cursor-grabbing"
      style={{ height: CANVAS_H, width: "100%" }}
      aria-label="Drag to reposition artwork, pinch to resize"
    >
      {/* Grid guide */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-10" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Crosshair */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-20">
        <div className="h-px w-full bg-foreground" />
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-20">
        <div className="h-full w-px bg-foreground" />
      </div>

      {/* Decal preview */}
      <motion.div
        style={{
          position: "absolute",
          left: `${px}%`,
          top: `${py}%`,
          transform: `translate(-50%, -50%) rotate(${(rotation * 180) / Math.PI}deg)`,
          width: `${previewSize}%`,
          aspectRatio: aspect,
        }}
        animate={{ left: `${px}%`, top: `${py}%` }}
        transition={{ type: "spring", stiffness: 500, damping: 40 }}
        className="pointer-events-none"
      >
        <img
          src={decalUrl}
          alt="Artwork preview"
          className="h-full w-full object-contain drop-shadow-lg"
          draggable={false}
        />
        {/* Bounding box */}
        <div className="absolute inset-0 rounded border border-primary/40 border-dashed" />
      </motion.div>

      {/* Hint */}
      <div className="pointer-events-none absolute bottom-2 left-0 right-0 flex justify-center">
        <span className="rounded-full bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur-sm">
          Drag · Pinch to resize
        </span>
      </div>
    </div>
  );
}

// ── Rotation dial ──────────────────────────────────────────────────────────

function RotationDial({ rotation, onChange }: { rotation: number; onChange: (r: number) => void }) {
  const deg = Math.round((rotation * 180) / Math.PI);
  const STEP = Math.PI / 12; // 15°

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-surface/60 p-2">
      <button
        onClick={() => onChange(rotation - STEP)}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground"
        aria-label="Rotate counter-clockwise 15°"
      >
        <RotateCw className="h-3.5 w-3.5 scale-x-[-1]" />
      </button>

      {/* Arc visualiser */}
      <div className="relative flex flex-1 items-center justify-center">
        <svg width="60" height="36" viewBox="0 0 60 36" className="overflow-visible">
          <path
            d="M 5 30 A 25 25 0 0 1 55 30"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-border"
          />
          {/* Needle */}
          <line
            x1="30"
            y1="30"
            x2={30 + 20 * Math.cos((rotation - Math.PI / 2))}
            y2={30 + 20 * Math.sin((rotation - Math.PI / 2))}
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="30" cy="30" r="3" fill="hsl(var(--primary))" />
        </svg>
        <span className="absolute bottom-0 left-0 right-0 text-center text-[11px] font-semibold text-foreground">
          {deg}°
        </span>
      </div>

      <button
        onClick={() => onChange(rotation + STEP)}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground"
        aria-label="Rotate clockwise 15°"
      >
        <RotateCw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Scale controls ─────────────────────────────────────────────────────────

function ScaleControls({
  scale, minScale, maxScale,
  onChange,
}: {
  scale: number; minScale: number; maxScale: number; onChange: (s: number) => void;
}) {
  const clamp = (v: number) => Math.max(minScale, Math.min(maxScale, v));
  const step = (maxScale - minScale) * 0.05;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-surface/60 p-2">
      <button
        onClick={() => onChange(clamp(scale - step))}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground"
        aria-label="Shrink"
      >
        <ZoomOut className="h-3.5 w-3.5" />
      </button>
      <div className="flex flex-1 flex-col items-center">
        <span className="text-[11px] font-semibold">{(scale * 100).toFixed(0)}%</span>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-border/40">
          <motion.div
            className="h-full rounded-full bg-primary"
            style={{ width: `${((scale - minScale) / (maxScale - minScale)) * 100}%` }}
            animate={{ width: `${((scale - minScale) / (maxScale - minScale)) * 100}%` }}
          />
        </div>
      </div>
      <button
        onClick={() => onChange(clamp(scale + step))}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground"
        aria-label="Grow"
      >
        <ZoomIn className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── DecalPanel ─────────────────────────────────────────────────────────────

export function DecalPanel() {
  const store = useStudioStore();
  const product = store.product;
  const fileRef = useRef<HTMLInputElement>(null);
  const [showFineTune, setShowFineTune] = useState(false);

  const selectedPrintArea = product?.printAreas.find((p) => p.id === store.selectedPrintAreaId);
  const currentArtwork = selectedPrintArea ? store.artworks[selectedPrintArea.id] : undefined;
  const safeArtwork = currentArtwork ? { ...getDefaultArtwork(), ...currentArtwork } : getDefaultArtwork();
  const capabilities = product?.studioCapabilities;

  const printAreaBounds = useMemo(() => {
    if (!selectedPrintArea) return null;
    const scaleFactor = 0.01;
    const halfWidth = (selectedPrintArea.widthCm * scaleFactor) / 2;
    const halfHeight = (selectedPrintArea.heightCm * scaleFactor) / 2;
    return {
      minX: selectedPrintArea.transformLimits?.minX ?? -halfWidth,
      maxX: selectedPrintArea.transformLimits?.maxX ?? halfWidth,
      minY: selectedPrintArea.transformLimits?.minY ?? -halfHeight,
      maxY: selectedPrintArea.transformLimits?.maxY ?? halfHeight,
      minScale: selectedPrintArea.transformLimits?.minScale ?? 0.05,
      maxScale: selectedPrintArea.transformLimits?.maxScale ?? Math.min(selectedPrintArea.widthCm, selectedPrintArea.heightCm) * scaleFactor,
    };
  }, [selectedPrintArea]);

  if (!product) return null;

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image"); return; }
    if (!selectedPrintArea) { toast.error("Select a print area first"); return; }

    const allowedTypes = selectedPrintArea.allowedFileTypes || ["png", "jpg", "svg"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!allowedTypes.includes(ext)) {
      toast.error(`This print area only accepts: ${allowedTypes.join(", ")}`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const aspect = img.naturalWidth / img.naturalHeight || 1;
        const bounds = printAreaBounds;
        const initialScale = bounds ? Math.min(bounds.maxScale * 0.8, 0.5) : 0.5;
        store.setArtwork(selectedPrintArea.id, {
          ...getDefaultArtwork(),
          decalUrl: dataUrl,
          decalAspect: aspect,
          decalScale: initialScale,
        });
        toast.success(`Artwork applied to ${selectedPrintArea.name}`);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const updateArtwork = (patch: Partial<typeof safeArtwork>) => {
    if (!selectedPrintArea) return;
    store.setArtwork(selectedPrintArea.id, { ...safeArtwork, ...patch });
  };

  if (!selectedPrintArea) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Select a print area to add or edit artwork.
      </p>
    );
  }

  if (capabilities && !capabilities.allowImages) return null;

  const bounds = printAreaBounds ?? {
    minX: -0.5, maxX: 0.5, minY: -0.7, maxY: 0.7, minScale: 0.05, maxScale: 2.5,
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileRef}
        type="file"
        accept={selectedPrintArea.allowedFileTypes?.map((t) => `.${t}`).join(",") ?? "image/*"}
        className="hidden"
        onChange={handleUpload}
      />

      {safeArtwork.decalUrl ? (
        <>
          {/* ── Gizmo ── */}
          <DecalGizmo
            offsetX={safeArtwork.decalOffsetX}
            offsetY={safeArtwork.decalOffsetY}
            scale={safeArtwork.decalScale}
            rotation={safeArtwork.decalRotation}
            aspect={safeArtwork.decalAspect}
            decalUrl={safeArtwork.decalUrl}
            minScale={bounds.minScale}
            maxScale={bounds.maxScale}
            minX={bounds.minX}
            maxX={bounds.maxX}
            minY={bounds.minY}
            maxY={bounds.maxY}
            onChange={(patch) =>
              updateArtwork({
                ...(patch.offsetX !== undefined && { decalOffsetX: patch.offsetX }),
                ...(patch.offsetY !== undefined && { decalOffsetY: patch.offsetY }),
                ...(patch.scale   !== undefined && { decalScale: patch.scale }),
                ...(patch.rotation !== undefined && { decalRotation: patch.rotation }),
              })
            }
          />

          {/* ── Scale strip ── */}
          {selectedPrintArea.allowScaling && (
            <ScaleControls
              scale={safeArtwork.decalScale}
              minScale={bounds.minScale}
              maxScale={bounds.maxScale}
              onChange={(s) => updateArtwork({ decalScale: s })}
            />
          )}

          {/* ── Rotation dial ── */}
          {selectedPrintArea.allowRotation && (
            <RotationDial
              rotation={safeArtwork.decalRotation}
              onChange={(r) => updateArtwork({ decalRotation: r })}
            />
          )}

          {/* ── Fine-tune toggle ── */}
          <button
            onClick={() => setShowFineTune((v) => !v)}
            className="flex items-center gap-1.5 self-start text-[11px] text-muted-foreground transition hover:text-foreground"
          >
            <SlidersHorizontal className="h-3 w-3" />
            {showFineTune ? "Hide fine-tune" : "Fine-tune"}
          </button>

          <AnimatePresence>
            {showFineTune && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 rounded-xl border border-border/40 bg-surface/60 p-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      X · {safeArtwork.decalOffsetX.toFixed(3)}
                    </Label>
                    <Slider
                      value={[safeArtwork.decalOffsetX]}
                      min={bounds.minX} max={bounds.maxX} step={0.005}
                      onValueChange={([v]) => updateArtwork({ decalOffsetX: v })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Y · {safeArtwork.decalOffsetY.toFixed(3)}
                    </Label>
                    <Slider
                      value={[safeArtwork.decalOffsetY]}
                      min={bounds.minY} max={bounds.maxY} step={0.005}
                      onValueChange={([v]) => updateArtwork({ decalOffsetY: v })}
                    />
                  </div>
                  {selectedPrintArea.allowScaling && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Scale · {safeArtwork.decalScale.toFixed(3)}
                      </Label>
                      <Slider
                        value={[safeArtwork.decalScale]}
                        min={bounds.minScale} max={bounds.maxScale} step={0.005}
                        onValueChange={([v]) => updateArtwork({ decalScale: v })}
                      />
                    </div>
                  )}
                  {selectedPrintArea.allowRotation && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Rotation · {((safeArtwork.decalRotation * 180) / Math.PI).toFixed(0)}°
                      </Label>
                      <Slider
                        value={[safeArtwork.decalRotation]}
                        min={-Math.PI} max={Math.PI} step={0.01}
                        onValueChange={([v]) => updateArtwork({ decalRotation: v })}
                      />
                    </div>
                  )}
                </div>
                {/* Area label + upload row */}
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-xs text-muted-foreground">
                    {selectedPrintArea.name} · {selectedPrintArea.widthCm}×{selectedPrintArea.heightCm}cm
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                    <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
                    {safeArtwork.decalUrl ? "Replace" : "Upload"}
                  </Button>
                  {safeArtwork.decalUrl && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        store.setArtwork(selectedPrintArea.id, getDefaultArtwork());
                        toast.success("Artwork removed");
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/40 py-10 text-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No artwork yet</p>
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            Upload image
          </Button>
        </div>
      )}
    </div>
  );
}