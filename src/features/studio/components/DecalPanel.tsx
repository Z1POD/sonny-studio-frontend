// src/features/studio/components/DecalPanel.tsx

import { useRef, useMemo } from "react";
import { Image as ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useStudioStore, getDefaultArtwork } from "../store";

export function DecalPanel() {
  const store = useStudioStore();
  const product = store.product;
  const fileRef = useRef<HTMLInputElement>(null);

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
      minX: -halfWidth,
      maxX: halfWidth,
      minY: -halfHeight,
      maxY: halfHeight,
      minScale: 0.05,
      maxScale: Math.min(selectedPrintArea.widthCm, selectedPrintArea.heightCm) * scaleFactor,
    };
  }, [selectedPrintArea]);

  if (!product) return null;

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image");
      return;
    }
    if (!selectedPrintArea) {
      toast.error("Select a print area first");
      return;
    }

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
        const areaAspect = selectedPrintArea.aspectRatio;
        const aspectDiff = areaAspect ? Math.abs(aspect - areaAspect) / areaAspect : 0;

        if (aspectDiff > 0.5) {
          toast.warning("Image aspect ratio differs from print area. The design may be cropped.", {
            duration: 5000,
          });
        }

        const bounds = printAreaBounds;
        const initialScale = bounds ? Math.min(bounds.maxScale * 0.8, 0.5) : 0.5;

        store.setArtwork(selectedPrintArea.id, {
          ...getDefaultArtwork(),
          decalUrl: dataUrl,
          decalAspect: aspect,
          decalScale: initialScale,
          decalRotation: 0,
          decalOffsetX: 0,
          decalOffsetY: 0,
        });
        toast.success(`Artwork applied to ${selectedPrintArea.name}`);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveArtwork = () => {
    if (!selectedPrintArea) return;
    store.setArtwork(selectedPrintArea.id, getDefaultArtwork());
    toast.success(`Artwork removed from ${selectedPrintArea.name}`);
  };

  const updateArtwork = (patch: Partial<typeof safeArtwork>) => {
    if (!selectedPrintArea) return;
    store.setArtwork(selectedPrintArea.id, { ...safeArtwork, ...patch });
  };

  const clampScale = (value: number) => {
    const limits = selectedPrintArea?.transformLimits;
    if (!limits) return Math.max(0.05, value);
    return Math.max(limits.minScale, Math.min(limits.maxScale, value));
  };

  const clampX = (value: number) => {
    const limits = selectedPrintArea?.transformLimits;
    if (!limits) return value;
    return Math.max(limits.minX, Math.min(limits.maxX, value));
  };

  const clampY = (value: number) => {
    const limits = selectedPrintArea?.transformLimits;
    if (!limits) return value;
    return Math.max(limits.minY, Math.min(limits.maxY, value));
  };

  if (!selectedPrintArea) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Select a print area to add or edit artwork.
      </p>
    );
  }

  if (!capabilities || capabilities.allowImages) {
    return (
      <div className="flex flex-col gap-3">
        <Label className="text-xs text-muted-foreground">Artwork · {selectedPrintArea.name}</Label>

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => fileRef.current?.click()}>
            <ImageIcon className="mr-2 h-4 w-4" /> Upload
          </Button>
          {safeArtwork.decalUrl && (
            <Button variant="ghost" size="icon" onClick={handleRemoveArtwork} title="Remove">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={
            selectedPrintArea.allowedFileTypes
              ? selectedPrintArea.allowedFileTypes.map((t) => `.${t}`).join(",")
              : "image/*"
          }
          className="hidden"
          onChange={handleUpload}
        />

        {safeArtwork.decalUrl ? (
          <div className="space-y-3 pt-2">
            <p className="text-[11px] text-muted-foreground">
              Use the sliders to move, rotate and scale. Original proportions are preserved
              ({safeArtwork.decalAspect.toFixed(2)}:1).
            </p>

            {selectedPrintArea.allowScaling && (
              <div>
                <Label className="text-xs text-muted-foreground">
                  Size · {safeArtwork.decalScale.toFixed(2)}
                </Label>
                <Slider
                  value={[safeArtwork.decalScale]}
                  min={printAreaBounds?.minScale ?? selectedPrintArea.transformLimits?.minScale ?? 0.05}
                  max={printAreaBounds?.maxScale ?? selectedPrintArea.transformLimits?.maxScale ?? 2.5}
                  step={0.01}
                  onValueChange={([v]) => updateArtwork({ decalScale: clampScale(v) })}
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
                  min={-Math.PI}
                  max={Math.PI}
                  step={0.01}
                  onValueChange={([v]) => updateArtwork({ decalRotation: v })}
                />
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground">
                Horizontal
                {printAreaBounds && (
                  <span className="ml-1 text-[9px] text-muted-foreground">
                    [{printAreaBounds.minX.toFixed(2)} to {printAreaBounds.maxX.toFixed(2)}]
                  </span>
                )}
              </Label>
              <Slider
                value={[safeArtwork.decalOffsetX]}
                min={printAreaBounds?.minX ?? selectedPrintArea.transformLimits?.minX ?? -0.5}
                max={printAreaBounds?.maxX ?? selectedPrintArea.transformLimits?.maxX ?? 0.5}
                step={0.01}
                onValueChange={([v]) => updateArtwork({ decalOffsetX: clampX(v) })}
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">
                Vertical
                {printAreaBounds && (
                  <span className="ml-1 text-[9px] text-muted-foreground">
                    [{printAreaBounds.minY.toFixed(2)} to {printAreaBounds.maxY.toFixed(2)}]
                  </span>
                )}
              </Label>
              <Slider
                value={[safeArtwork.decalOffsetY]}
                min={printAreaBounds?.minY ?? selectedPrintArea.transformLimits?.minY ?? -0.7}
                max={printAreaBounds?.maxY ?? selectedPrintArea.transformLimits?.maxY ?? 0.7}
                step={0.01}
                onValueChange={([v]) => updateArtwork({ decalOffsetY: clampY(v) })}
              />
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            No artwork applied yet. Upload an image to place it on {selectedPrintArea.name}.
          </p>
        )}
      </div>
    );
  }

  return null;
}