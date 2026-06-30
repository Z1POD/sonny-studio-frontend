// src/features/studio/hooks/useStudioCheckout.ts
//
// Encapsulates the "Continue to checkout" flow:
//   1. Capture multi-angle mockups via StudioCanvas
//   2. Create or update the store product
//   3. Upload mockup assets
//   4. Open the checkout sheet
//
// Keeping this out of StudioWorkspace reduces that component to pure layout.

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useStudioStore } from "../store";
import { useCheckoutStore } from "@/features/checkout/store";
import { useAuthStore } from "@/features/auth/store";
import { storeProductApi } from "@/features/store/api";
import type { StudioCanvasHandle } from "../components/StudioCanvas";
import type { ShotConfig } from "../components/SaveProductDialog";

const CM = 0.01;

async function blobFromDataUrl(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

interface UseStudioCheckoutOptions {
  canvasRef: React.RefObject<StudioCanvasHandle>;
  savedProductId: string | null;
}

export function useStudioCheckout({ canvasRef, savedProductId }: UseStudioCheckoutOptions) {
  const [isCapturing, setIsCapturing]         = useState(false);
  const [capturedMockups, setCapturedMockups] = useState<string[]>([]);

  const product         = useStudioStore((s) => s.product);
  const artworks        = useStudioStore((s) => s.artworks);
  const selectedColor   = useStudioStore((s) => s.selectedColor);
  const selectedMethods = useStudioStore((s) => s.selectedMethods);
  const selectedTiers   = useStudioStore((s) => s.selectedTiers);
  const openCheckout    = useCheckoutStore((s) => s.open);

  // Print cost─
  const calculatePrintCost = useCallback((): number => {
    if (!product) return 0;
    let cost = 0;
    for (const area of product.printAreas) {
      if (!artworks[area.id]?.decalUrl) continue;
      const methodCode = selectedMethods[area.id] ?? area.methods[0]?.code ?? "";
      const tierSize   = selectedTiers[area.id]   ?? area.methods[0]?.tiers[0]?.size ?? "";
      const method     = area.methods.find((m) => m.code === methodCode) ?? area.methods[0];
      const tier       = method?.tiers.find((t) => t.size === tierSize)  ?? method?.tiers[0];
      if (tier) cost += parseFloat(tier.price) || 0;
    }
    return cost;
  }, [product, artworks, selectedMethods, selectedTiers]);

  // Print-areas payload
  const buildPrintAreasPayload = useCallback(() => {
    if (!product) return [];
    return product.printAreas
      .filter((p) => artworks[p.id]?.decalUrl)
      .map((area) => {
        const art        = artworks[area.id];
        const methodCode = selectedMethods[area.id] ?? area.methods[0]?.code ?? "";
        if (!methodCode) {
          throw new Error(
            `No print method resolved for print area "${area.name}". ` +
            `This usually means the product was loaded without method/tier data.`,
          );
        }
        return {
          print_area:    area.areaKey,
          print_area_id: area.id,
          print_method:  methodCode,
          width_cm:      area.widthCm.toFixed(2),
          height_cm:     area.heightCm.toFixed(2),
          color_count:   1,
          design_data: {
            layers: [{
              type:         "image" as const,
              url:          art.decalUrl,
              aspect_ratio: art.decalAspect,
              position:     { x: art.decalOffsetX, y: art.decalOffsetY },
              offset_x:     art.decalOffsetX,
              offset_y:     art.decalOffsetY,
              scale:        art.decalScale,
              rotation:     art.decalRotation,
              z_index:      0,
            }],
          },
        };
      });
  }, [product, artworks, selectedMethods, selectedTiers]);

  // render_config snapshot─
  const buildRenderConfig = useCallback(() => {
    if (!product) return {};
    const cam    = product.cameraConfig;
    const render = product.renderConfig;
    const activeAreas = product.printAreas.filter((p) => artworks[p.id]?.decalUrl);
    return {
      version:          3,
      background:       render.background,
      environment:      render.environment,
      model_position:   render.modelPosition,
      model_url:        product.modelUrl,
      colorable_meshes: product.colorableMeshes,
      material:         product.materialConfig,
      camera: {
        position: cam.position,
        fov:      cam.fov,
        orbit: {
          min_distance:    cam.orbit.minDistance,
          max_distance:    cam.orbit.maxDistance,
          min_polar_angle: cam.orbit.minPolarAngle,
          max_polar_angle: cam.orbit.maxPolarAngle,
          enable_pan:      cam.orbit.enablePan,
          enable_zoom:     cam.orbit.enableZoom,
        },
        capture_distance_scale:      cam.captureDistanceScale,
        capture_look_at_offset:      cam.captureLookAtOffset,
      },
      lighting:        (render as any).lighting,
      contact_shadows: render.contactShadows,
      shots: [
        { id: "front", label: "Front",     azimuth: 0,           polar: Math.PI / 2,   enabled: true },
        { id: "back",  label: "Back",      azimuth: Math.PI,     polar: Math.PI / 2,   enabled: true },
        { id: "angle", label: "3/4 Angle", azimuth: Math.PI / 6, polar: Math.PI / 2.4, enabled: true },
      ],
      print_areas: activeAreas.map((area) => {
        const methodCode = selectedMethods[area.id] ?? area.methods[0]?.code ?? "";
        const tierSize   = selectedTiers[area.id]   ?? area.methods[0]?.tiers[0]?.size ?? "";
        const method     = area.methods.find((m) => m.code === methodCode) ?? area.methods[0];
        const tier       = method?.tiers.find((t) => t.size === tierSize)  ?? method?.tiers[0];
        return {
          print_area_id: area.id,
          area_key:      area.areaKey,
          name:          area.name,
          placement:     area.placement,
          mesh_name:     area.meshName,
          width_cm:      area.widthCm,
          height_cm:     area.heightCm,
          uv_config:     {},
          // Persisted so the edit/resume flow can rebuild `methods` without
          // a second apparel fetch — see mapSavedProductToApparelProduct.
          print_method_code: method?.code ?? "",
          print_method_name: method?.name ?? "",
          size_tier:         tierSize,
          price:             tier?.price ?? "0.00",
          extra_color_price: tier?.extra_color_price ?? "0.00",
        };
      }),
      // Artwork transforms — restored by hydrateStudioFromSavedDesign on re-open
      artworkPrintInfos: activeAreas.map((area) => {
        const art = artworks[area.id];
        return {
          printAreaId:   area.id,
          printAreaName: area.name,
          areaKey:       area.areaKey,
          widthCm:       area.widthCm,
          heightCm:      area.heightCm,
          sizeTier:      "large",
          decalUrl:      art.decalUrl,
          decalAspect:   art.decalAspect,
          decalScale:    art.decalScale,
          decalRotation: art.decalRotation,
          decalOffsetX:  art.decalOffsetX,
          decalOffsetY:  art.decalOffsetY,
        };
      }),
    };
  }, [product, artworks, selectedMethods, selectedTiers]);

  // Main handler
  const handleContinueToCheckout = useCallback(async () => {
    if (!canvasRef.current || !product) {
      toast.error("Canvas not ready");
      return;
    }
    const activeAreas = product.printAreas.filter((p) => artworks[p.id]?.decalUrl);
    if (activeAreas.length === 0) {
      toast.error("Add artwork to at least one print area");
      return;
    }

    setIsCapturing(true);
    toast.info("Saving your design…");

    try {
      const shots: ShotConfig[] = [
        { id: "front", label: "Front",     azimuth: 0,           polar: Math.PI / 2,   enabled: true },
        { id: "back",  label: "Back",      azimuth: Math.PI,     polar: Math.PI / 2,   enabled: true },
        { id: "angle", label: "3/4 Angle", azimuth: Math.PI / 6, polar: Math.PI / 2.4, enabled: true },
      ];

      const capturedShots = await canvasRef.current.captureAllShots(shots);
      const dataUrls      = capturedShots.filter((s) => s.dataUrl).map((s) => s.dataUrl!);
      const mainMockup    = dataUrls[0] ?? canvasRef.current.capture();
      setCapturedMockups(dataUrls);

      const renderConfig      = buildRenderConfig();
      const printAreasPayload = buildPrintAreasPayload();
      const enabledVariantIds = product.variants.filter((v) => v.isInStock).map((v) => v.id);

      let savedProduct: any;

      if (savedProductId) {
        savedProduct = await storeProductApi.update(savedProductId, {
          title:            product.name,
          enabled_variants: enabledVariantIds,
          print_areas:      printAreasPayload,
          snapshot:         { render_config: renderConfig },
          render_config:    renderConfig,
        } as any);
      } else {
        savedProduct = await storeProductApi.create({
          title:              `${product.name} — Custom`,
          description:        `Custom ${product.name} with artwork`,
          base_apparel:       product.id,
          markup_price:       "0",
          print_areas:        printAreasPayload,
          snapshot:           { render_config: renderConfig },
          render_config:      renderConfig,
          enabled_variants:   enabledVariantIds,
          is_limited_edition: false,
          max_quantity:       null,
          production_ready:   true,
        });
      }

      // Upload mockup blobs
      const blobs = await Promise.all(
        capturedShots
          .filter((s) => s.enabled && s.dataUrl)
          .map(async (shot) => ({
            blob: await blobFromDataUrl(shot.dataUrl!),
            type: shot.id,
            name: `mockup-${shot.id}.png`,
          })),
      );
      const assetsData = await storeProductApi.uploadAssets(
        savedProduct.id ?? savedProductId,
        blobs,
      );

      const pricing        = savedProduct.pricing ?? {};
      const basePrice      = parseFloat(pricing.base_price ?? product.basePrice ?? "0");
      const printCost      = calculatePrintCost();
      const currencySymbol =
        typeof pricing.currency === "object"
          ? pricing.currency.symbol
          : product.currencySymbol ?? "Br";

      const user = useAuthStore.getState().user;

      openCheckout({
        userFullName:         user?.display_name ?? user?.username ?? "",
        productId:            savedProduct.id ?? savedProductId!,
        productName:          savedProduct.title ?? product.name,
        thumbnailUrl:         assetsData.thumbnail_url ?? mainMockup ?? undefined,
        mockupUrl:            mainMockup ?? undefined,
        mockupUrls:           dataUrls,
        basePrice,
        printCost,
        currencySymbol,
        variants:             product.variants.map((v) => ({ ...v, quantity: 1 })),
        artworks,
        printAreas:           product.printAreas.map((p) => ({
          id: p.id, name: p.name, widthCm: p.widthCm, heightCm: p.heightCm, areaKey: p.areaKey,
        })),
        selectedColor:        selectedColor ?? undefined,
        preselectedVariantId: product.variants.find((v) => v.color.hex === selectedColor)?.id,
      });

      toast.success("Design saved. Continue to checkout.");
    } catch (err: any) {
      toast.error(err?.data?.error?.message ?? err?.message ?? "Failed to save design");
      console.error(err);
    } finally {
      setIsCapturing(false);
    }
  }, [
    product, artworks, selectedColor, savedProductId,
    buildPrintAreasPayload, buildRenderConfig, calculatePrintCost, openCheckout, canvasRef,
  ]);

  return { isCapturing, capturedMockups, handleContinueToCheckout };
}