/**
 * src/features/studio/components/StudioWorkspace.tsx — v3
 *
 * - Calls captureAllShots() synchronously (no async orbital rotation)
 * - Passes basePrice to SaveProductDialog for live price preview
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Shirt } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useModal, useSheet } from "@/shared/hooks/use-overlays";
import { buildCompleteRenderConfig, buildSceneSnapshot, useStudioStore, getDefaultArtwork } from "../store";
import { studioDetailQuery } from "../queries";
import { SaveProductDialog, DEFAULT_SHOTS, type ShotConfig } from "./SaveProductDialog";
import { StudioCanvas, type StudioCanvasHandle } from "./StudioCanvas";
import { StudioControls } from "./StudioControls";
import { ArtworkLibrary } from "./ArtworkLibrary";
import { CanvasDrop } from "./CanvasDrop";
import { Button } from "@/components/ui/button";

const CM = 0.01;

export function StudioWorkspace() {
  const canvasRef = useRef<StudioCanvasHandle>(null);
  const [mounted, setMounted] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const modal = useModal();
  const sheet = useSheet();
  const routerState = useRouterState();

  const locationState = routerState.location.state as { apparelId?: string } | undefined;
  const apparelId = locationState?.apparelId ?? null;
  const hasApparel = Boolean(apparelId);

  const setProduct = useStudioStore((s) => s.setProduct);
  const product = useStudioStore((s) => s.product);
  const selectedPrintAreaId = useStudioStore((s) => s.selectedPrintAreaId);
  const setArtwork = useStudioStore((s) => s.setArtwork);
  const artworks = useStudioStore((s) => s.artworks);

  const { data, isLoading, error } = useQuery({
    ...studioDetailQuery(apparelId ?? ""),
    enabled: hasApparel,
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!data) return;
    const d = (data as any).data ?? data;
    const config = d["3d_configuration"];
    const render = config.render_config;

    setProduct({
      id: d.apparel.id,
      name: d.apparel.name,
      slug: d.apparel.slug,
      description: d.apparel.description ?? "",
      basePrice: d.apparel.pricing?.base_price ?? d.apparel.base_price ?? "0.00",
      currencySymbol: d.apparel.pricing?.currency?.symbol ?? "$",
      modelUrl: config.model?.glb_url ?? "models/shirt.glb",
      environment: render.environment,
      cameraConfig: {
        position: render.camera.position,
        fov: render.camera.fov,
        orbit: {
          minDistance: render.camera.orbit.min_distance,
          maxDistance: render.camera.orbit.max_distance,
          minPolarAngle: render.camera.orbit.min_polar_angle,
          maxPolarAngle: render.camera.orbit.max_polar_angle,
          enablePan: render.camera.orbit.enable_pan,
          enableZoom: render.camera.orbit.enable_zoom,
        },
      },
      renderConfig: {
        environment: render.environment,
        background: render.background,
        modelPosition: render.model_position,
        ...(render.lighting ? { lighting: render.lighting } : {}),
        contactShadows: {
          enabled: render.contact_shadows.enabled,
          position: render.contact_shadows.position,
          opacity: render.contact_shadows.opacity,
          scale: render.contact_shadows.scale,
          blur: render.contact_shadows.blur,
          far: render.contact_shadows.far,
        },
      },
      materialConfig: {
        textureUrl: config.material?.texture_url || null,
        normalMapUrl: config.material?.normal_map_url || null,
        roughness: config.material?.roughness ?? 0.9,
        metalness: config.material?.metalness ?? 0,
      },
      colors: [...new Set<string>(d.variants.map((v: any) => v.color.hex))],
      colorableMeshes: render.colorable_meshes ?? config.colorable_meshes ?? [],
      printAreas: d.print_areas.map((p: any) => {
        const uvConfig = p.uv_config || {};
        const rawWorldBounds = uvConfig.world_bounds;
        const rawUvBounds = uvConfig.uv_bounds;
        const rawTransformLimits = uvConfig.transform_limits;
        return {
          id: p.id,
          areaKey: p.key ?? p.area_key,
          name: p.name,
          placement: p.placement,
          meshName: p.mesh ?? p.mesh_name,
          aspectRatio: p.ratio ?? p.aspect_ratio,
          allowScaling: p.rules?.scale ?? p.allow_scaling ?? true,
          allowRotation: p.rules?.rotate ?? p.allow_rotation ?? false,
          maxLayers: p.rules?.max_layers ?? p.max_layers ?? 1,
          widthCm: p.w ?? p.width_cm ?? 35,
          heightCm: p.h ?? p.height_cm ?? 42,
          allowedFileTypes: p.rules?.file_types ?? p.allowed_file_types ?? ["png", "jpg", "svg"],
          sortOrder: p.sort,
          currency: p.currency,
          // New: methods array from backend
          methods: (p.methods ?? []).map((m: any) => ({
            code: m.code,
            name: m.name,
            tiers: (m.tiers ?? []).map((t: any) => ({
              size: t.size,
              max_w: t.max_w,
              max_h: t.max_h,
              price: t.price,
              extra_color_price: t.extra_color_price ?? "0.00",
            })),
          })),
          uvBounds: rawUvBounds && typeof rawUvBounds === "object"
            ? { minU: rawUvBounds.min_u, minV: rawUvBounds.min_v, maxU: rawUvBounds.max_u, maxV: rawUvBounds.max_v }
            : undefined,
          worldBounds: rawWorldBounds && typeof rawWorldBounds === "object"
            ? { center: rawWorldBounds.center, halfExtents: rawWorldBounds.half_extents, rotation: rawWorldBounds.rotation }
            : undefined,
          transformLimits: rawTransformLimits && typeof rawTransformLimits === "object"
            ? { minScale: rawTransformLimits.min_scale, maxScale: rawTransformLimits.max_scale, minX: rawTransformLimits.min_x, maxX: rawTransformLimits.max_x, minY: rawTransformLimits.min_y, maxY: rawTransformLimits.max_y }
            : undefined,
          cameraFocus: p.camera_focus ? { position: p.camera_focus.position, target: p.camera_focus.target } : undefined,
          previewImage: p.preview_image,
        };
      }),
      variants: d.variants.map((v: any) => ({
        id: v.id,
        sku: v.sku,
        color: v.color,
        size: v.size,
        stockQuantity: v.stock_quantity,
        isInStock: v.is_in_stock,
        additionalPrice: v.additional_price,
      })),
      defaultView: render.default_view,
      studioCapabilities: d.studio_capabilities ? {
        allowText: d.studio_capabilities.allow_text,
        allowImages: d.studio_capabilities.allow_images,
        allowSvg: d.studio_capabilities.allow_svg,
        allowMultipleLayers: d.studio_capabilities.allow_multiple_layers,
        allowColorChange: d.studio_capabilities.allow_color_change,
        allowArPreview: d.studio_capabilities.allow_ar_preview,
      } : undefined,
    });
  }, [data, setProduct]);

  const handleSave = async () => {
    if (!canvasRef.current || !product) { 
      toast.error("Canvas not ready"); 
      return; 
    }
    setIsCapturing(true);
    try {
      const capturedShots = await canvasRef.current.captureAllShots(DEFAULT_SHOTS);
      const snapshot = buildSceneSnapshot(useStudioStore.getState());
      const renderConfig = buildCompleteRenderConfig(useStudioStore.getState(), capturedShots);

      let sheetId: string;  // Declare first

      sheetId = sheet.open({  // Then assign
        title: "Publish product",
        content: (
          <SaveProductDialog
            shots={capturedShots}
            snapshot={snapshot}
            renderConfig={renderConfig}
            sheetId={sheetId}  // Now accessible
            variants={product.variants ?? []}
            printAreas={product.printAreas}
            artworks={artworks}
            baseApparelId={product.id}
            canvasBackground={(product.renderConfig as any).background ?? "#ffffff"}
            basePrice={product.basePrice}
            currencySymbol={product.currencySymbol ?? "$"}
          />
        ),
        dismissible: true,
      });
    } catch (err) {
      toast.error("Failed to capture shots");
      console.error(err);
    } finally {
      setIsCapturing(false);
    }
  };

  /* ── Apply artwork ────────────────────────────────────────────────────── */
  const handleArtworkSelect = ({ url, aspect }: { url: string; aspect: number }) => {
    if (!selectedPrintAreaId) { toast.error("Select a print area first"); return; }
    const printArea = product?.printAreas.find((p) => p.id === selectedPrintAreaId);
    if (!printArea) { toast.error("Print area not found"); return; }
    const initialScale = Math.min(printArea.widthCm, printArea.heightCm) * CM * 0.6;
    setArtwork(selectedPrintAreaId, {
      ...getDefaultArtwork(),
      decalUrl: url,
      decalAspect: aspect,
      decalScale: initialScale,
      decalRotation: 0,
      decalOffsetX: 0,
      decalOffsetY: 0,
    });
    toast.success(`Artwork applied to ${printArea.name}`);
  };

  if (!hasApparel) {
    return (
      <div className="flex h-[calc(100dvh-7.5rem)] flex-col items-center justify-center gap-4">
        <Button asChild className="rounded-full">
          <Link to="/catalog"><Shirt className="mr-2 h-4 w-4" /> Open Catalog</Link>
        </Button>
        <p className="text-sm text-muted-foreground">Choose an apparel to start designing</p>
      </div>
    );
  }

  if (isLoading || !mounted) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-red-500">
        Failed to load studio product
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100dvh-0rem)] w-full overflow-hidden bg-background md:h-[calc(100dvh-3.5rem)]">
      <CanvasDrop onUploaded={handleArtworkSelect}>
        <StudioCanvas ref={canvasRef} />
      </CanvasDrop>
      <ArtworkLibrary onSelect={handleArtworkSelect} />
      <StudioControls onSave={handleSave} isSaving={isCapturing} />
      <div className="pointer-events-none hidden md:flex absolute top-1 left-16 z-10 rounded-full border border-border/60 bg-surface/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur-md">
        Drag to rotate · scroll to zoom · drop artwork to upload
      </div>
    </div>
  );
}