// src/features/studio/components/StudioWorkspace.tsx


import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Shirt } from "lucide-react";
import { toast } from "sonner";
import { useStudioStore, getDefaultArtwork } from "../store";
import { StudioCanvas, type StudioCanvasHandle } from "./StudioCanvas";
import { StudioControls } from "./StudioControls";
import { ArtworkLibrary } from "./ArtworkLibrary";
import { CanvasDrop } from "./CanvasDrop";
import { Button } from "@/components/ui/button";
import { CheckOut } from "@/features/checkout/components/CheckOut";
import { useStudioInit } from "../hooks/useStudioInit";
import { useStudioCheckout } from "../hooks/useStudioCheckout";
import { useTelegram } from "@/shared/hooks/use-telegram";
import { BrandLoader } from "@/components/ui/loader";

const CM = 0.01;

export function StudioWorkspace() {
  const canvasRef = useRef<StudioCanvasHandle>(null);
  const [mounted, setMounted]                       = useState(false);
  const [artworkLibraryOpen, setArtworkLibraryOpen] = useState(false);
  const [canvasError, setCanvasError]               = useState(false);
  const [modelLoading, setModelLoading]              = useState(true);

  useEffect(() => setMounted(true), []);
  const { enableClosingConfirmation, disableClosingConfirmation } = useTelegram();

  useEffect(() => {
    enableClosingConfirmation();

    return () => {
      disableClosingConfirmation();
    };
  }, [enableClosingConfirmation, disableClosingConfirmation]);


  //  Init (fetch + hydrate) 
  const { apparelId, savedProductId, isLoading } = useStudioInit();

  //  Studio store (only what the layout needs directly) 
  const product             = useStudioStore((s) => s.product);
  const selectedPrintAreaId = useStudioStore((s) => s.selectedPrintAreaId);
  const setArtwork          = useStudioStore((s) => s.setArtwork);

  //  Save / checkout 
  const { isCapturing, capturedMockups, handleContinueToCheckout } = useStudioCheckout({
    canvasRef,
    savedProductId,
  });

  //  Apply artwork from library / drag-and-drop 
  const handleArtworkSelect = ({ url, aspect }: { url: string; aspect: number }) => {
    if (!selectedPrintAreaId) { toast.error("Select a print area first"); return; }
    const printArea = product?.printAreas.find((p) => p.id === selectedPrintAreaId);
    if (!printArea) { toast.error("Print area not found"); return; }
    const initialScale = Math.min(printArea.widthCm, printArea.heightCm) * CM * 0.6;
    setArtwork(selectedPrintAreaId, {
      ...getDefaultArtwork(),
      decalUrl:    url,
      decalAspect: aspect,
      decalScale:  initialScale,
    });
    toast.success(`Artwork applied to ${printArea.name}`);
  };

  //  Guards 
  const hasSource    = !!apparelId || !!savedProductId;
  const isLoadingAny = isLoading || !mounted;

  if (!hasSource) {
    return (
      <div className="flex h-[calc(100dvh-7.5rem)] flex-col items-center justify-center gap-4">
        <Button asChild className="rounded-full">
          <Link to="/catalog">
            <Shirt className="mr-2 h-4 w-4" />
            Open Catalog
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Choose an apparel to start designing</p>
      </div>
    );
  }

  if (isLoadingAny || !product) {
    return (
      <div className="flex h-[70dvh] items-center justify-center text-muted-foreground">
        <BrandLoader size="md" />
      </div>
    );
  }

  return (
    <>
      <div className="relative h-[calc(100dvh-0rem)] w-full overflow-hidden bg-background">
        <CanvasDrop onUploaded={handleArtworkSelect}>
          <StudioCanvas
            ref={canvasRef}
            onError={() => setCanvasError(true)}
            onLoadingChange={(loading) => setModelLoading(loading)}
          />
        </CanvasDrop>

        {!canvasError && (
          <>
            <ArtworkLibrary
              onSelect={handleArtworkSelect}
              isOpen={artworkLibraryOpen}
              onClose={() => setArtworkLibraryOpen(false)}
            />

            <div
              aria-hidden={modelLoading}
              className={
                modelLoading
                  ? "pointer-events-none opacity-40 transition-opacity"
                  : "transition-opacity"
              }
            >
              <StudioControls
                onSave={handleContinueToCheckout}
                isSaving={isCapturing}
                onContinue={handleContinueToCheckout}
                onToggleArtworkLibrary={() => setArtworkLibraryOpen((v) => !v)}
                artworkLibraryOpen={artworkLibraryOpen}
              />
            </div>

            <div className="pointer-events-none hidden md:flex absolute bottom-1 left-4 z-10 rounded-full border border-border/60 bg-surface/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur-md">
              Drag to rotate · scroll to zoom · drop artwork to upload
            </div>
          </>
        )}

        {canvasError && (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background/95 px-6 text-center backdrop-blur-xl">
            <p className="text-sm font-medium text-foreground">
              Unable to load 3D preview.
            </p>
            <p className="text-xs text-muted-foreground">
              Something went wrong while rendering this product. Please go back and try again.
            </p>
            <Button asChild className="mt-2 rounded-full">
              <Link to="/designs">
                <Shirt className="mr-2 h-4 w-4" />
                Go home
              </Link>
            </Button>
          </div>
        )}
      </div>

      <CheckOut mockupUrls={capturedMockups} />
    </>
  );
}