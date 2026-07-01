// src/features/studio/components/DecalPanel.tsx
/**
 * DecalPanel.tsx — v3
 *
 * Artwork manipulation now happens directly on the model via an on-model
 * TransformControls gizmo (see ProductModel.tsx) — tap a decal in the 3D
 * view to select it, then drag its handles. This panel:
 * - Switches the gizmo's handle type (move / rotate / scale)
 * - Exposes the same values as precise sliders behind "Fine-tune" (both
 *   read/write the same store fields as the gizmo, so they always agree)
 * - Retains upload / remove actions
 */

import { useRef, useMemo, useState } from "react";
import { Image as ImageIcon, Trash2, Move, RotateCw, Maximize2, ZoomIn, ZoomOut, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useStudioStore, getDefaultArtwork, type TransformMode } from "../store";

//  On-model gizmo mode switch
// Controls which TransformControls handle (translate/rotate/scale) is shown
// on the model for the currently-selected decal.

function GizmoModeSwitch({
  mode,
  onChange,
  allowRotation,
  allowScaling,
}: {
  mode: TransformMode;
  onChange: (mode: TransformMode) => void;
  allowRotation: boolean;
  allowScaling: boolean;
}) {
  const options: Array<{ value: TransformMode; label: string; icon: typeof Move; enabled: boolean }> = [
    { value: "translate", label: "Move",   icon: Move,      enabled: true },
    { value: "rotate",    label: "Rotate", icon: RotateCw,  enabled: allowRotation },
    { value: "scale",     label: "Scale",  icon: Maximize2, enabled: allowScaling },
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1 rounded-xl border border-border/40 bg-surface/60 p-1">
        {options.filter((o) => o.enabled).map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => onChange(value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition ${
              mode === value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
            }`}
            aria-pressed={mode === value}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
      <p className="text-center text-[11px] text-muted-foreground/70">
        Tap the artwork on the model, then drag its handles
      </p>
    </div>
  );
}

//  Rotation dial 

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

//  Scale controls

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

//  DecalPanel

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
          {/*  On-model gizmo mode switch  */}
          <GizmoModeSwitch
            mode={store.transformMode}
            onChange={store.setTransformMode}
            allowRotation={!!selectedPrintArea.allowRotation}
            allowScaling={!!selectedPrintArea.allowScaling}
          />

          {/*  Scale strip  */}
          {selectedPrintArea.allowScaling && (
            <ScaleControls
              scale={safeArtwork.decalScale}
              minScale={bounds.minScale}
              maxScale={bounds.maxScale}
              onChange={(s) => updateArtwork({ decalScale: s })}
            />
          )}

          {/*  Rotation dial  */}
          {selectedPrintArea.allowRotation && (
            <RotationDial
              rotation={safeArtwork.decalRotation}
              onChange={(r) => updateArtwork({ decalRotation: r })}
            />
          )}

          {/*  Fine-tune toggle  */}
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