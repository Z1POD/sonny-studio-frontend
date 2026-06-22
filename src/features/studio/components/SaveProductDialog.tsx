/**
 * src/features/studio/components/SaveProductDialog.tsx — v8.0
 *
 * Changes:
 *  - Converted from Modal to Drawer (sheet) using overlay-store
 *  - Fixed pricing: markup_price is now actual currency amount (base * pct / 100)
 *    retail_price = base_price + printCost + markup_price
 *  - All existing functionality preserved: tabs, validation, submission, success flow
 */

import { useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  X,
  Copy,
  ExternalLink,
  Loader2,
  Sparkles,
  Info,
  Save,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Star,
  ImageIcon,
  Send,
  PackageCheck,
  CloudUpload,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useOverlayStore } from "@/shared/stores/overlay-store";
import { storeProductApi } from "@/features/store/api";
import { useStudioStore } from "../store";
import { useTelegram } from "@/shared/hooks/use-telegram";
import { useShareDrawer } from "@/shared/components/ShareDrawer";
import type { SceneSnapshot, PrintArea, ArtworkState } from "../store";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShotConfig {
  id: string;
  label: string;
  azimuth: number;
  polar: number;
  enabled: boolean;
  dataUrl?: string;
}

interface Variant {
  id: string;
  sku: string;
  color: { name: string; hex: string };
  size: string;
  stockQuantity: number;
  isInStock: boolean;
  additionalPrice: string;
}

export interface Props {
  shots: ShotConfig[];
  snapshot: SceneSnapshot;
  sheetId: string;  // Changed from modalId
  variants: Variant[];
  printAreas: PrintArea[];
  artworks: Record<string, ArtworkState>;
  baseApparelId: string;
  canvasBackground?: string;
  basePrice?: string;
  currencySymbol?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyPrintSize(w: number, h: number) {
  const a = w * h;
  if (a <= 25) return "logo";
  if (a <= 74) return "a6";
  if (a <= 149) return "a5";
  if (a <= 312) return "a4";
  if (a <= 624) return "a3";
  return "large";
}

const TIER_LABELS: Record<string, string> = {
  logo: "Logo", a6: "A6", a5: "A5", a4: "A4", a3: "A3", large: "Large",
};

async function blobFromDataUrl(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

export const DEFAULT_SHOTS: ShotConfig[] = [
  { id: "front", label: "Front",    azimuth: 0,           polar: Math.PI / 2,       enabled: true  },
  { id: "back",  label: "Back",     azimuth: Math.PI,     polar: Math.PI / 2,       enabled: true  },
  { id: "left",  label: "Left",     azimuth: -Math.PI/2,  polar: Math.PI / 2,       enabled: false },
  { id: "right", label: "Right",    azimuth: Math.PI/2,   polar: Math.PI / 2,       enabled: false },
  { id: "angle", label: "3/4 Angle",azimuth: Math.PI / 6, polar: Math.PI / 2.4,     enabled: true  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// FORM COMPONENTS (unchanged)
// ═══════════════════════════════════════════════════════════════════════════════

function HeroMockup({ shots, primaryShotId, onSetPrimary, onToggle, canvasBackground }: any) {
  const enabledShots = shots.filter((s: ShotConfig) => s.enabled && s.dataUrl);
  const primaryShot = enabledShots.find((s: ShotConfig) => s.id === primaryShotId) ?? enabledShots[0];
  const thumbnails = enabledShots.filter((s: ShotConfig) => s.id !== primaryShot?.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Product Preview</h3>
        <span className="text-[10px] text-muted-foreground">
          {enabledShots.length} shot{enabledShots.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div
        className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border/40"
        style={{ backgroundColor: canvasBackground || "#ffffff" }}
      >
        {primaryShot?.dataUrl ? (
          <img src={primaryShot.dataUrl} alt={primaryShot.label} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        {primaryShot && (
          <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/50 px-2 py-0.5 backdrop-blur-sm">
            <Star className="h-3 w-3 text-yellow-400" fill="currentColor" />
            <span className="text-[10px] font-medium text-white">Primary</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {thumbnails.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto">
            {thumbnails.map((shot: ShotConfig) => (
              <button
                key={shot.id}
                onClick={() => onSetPrimary(shot.id)}
                className="group relative flex-shrink-0 overflow-hidden rounded-lg border border-border/40 transition hover:border-primary/60"
                style={{ width: 56, height: 56, backgroundColor: canvasBackground || "#ffffff" }}
              >
                <img src={shot.dataUrl} alt={shot.label} className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          {shots.map((shot: ShotConfig) => (
            <button
              key={shot.id}
              onClick={() => onToggle(shot.id)}
              className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium transition ${
                shot.enabled
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border/40 bg-surface-elevated/30 text-muted-foreground"
              }`}
            >
              {shot.enabled ? <Check className="h-2 w-2" /> : <X className="h-2 w-2" />}
              {shot.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function VariantMatrix({ variants, enabledIds, onToggle }: any) {
  const colors = useMemo(() => [...new Map(variants.map((v: Variant) => [v.color.hex, v.color])).values()], [variants]);
  const sizes = useMemo(() => [...new Set(variants.map((v: Variant) => v.size))], [variants]);
  const getV = (hex: string, size: string) => variants.find((v: Variant) => v.color.hex === hex && v.size === size);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Sizes & Colors</Label>
        <button
          onClick={() => {
            const all = variants.every((v: Variant) => enabledIds.has(v.id));
            variants.forEach((v: Variant) => { if (all === enabledIds.has(v.id)) onToggle(v.id); });
          }}
          className="text-[10px] text-primary hover:underline"
        >
          {variants.every((v: Variant) => enabledIds.has(v.id)) ? "Deselect all" : "Select all"}
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border/40">
        <table className="w-full min-w-[240px] text-xs">
          <thead>
            <tr className="border-b border-border/40 bg-surface-elevated/40">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Color</th>
              {sizes.map((s: string) => (
                <th key={s} className="px-2 py-2 text-center font-medium text-muted-foreground">{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {colors.map((color: { hex: string; name: string }, i: number) => (
              <tr key={color.hex} className={i % 2 === 0 ? "bg-surface/30" : "bg-surface-elevated/20"}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 rounded-full border border-border/40" style={{ background: color.hex }} />
                    <span className="text-[11px]">{color.name}</span>
                  </div>
                </td>
                {sizes.map((size: string) => {
                  const v = getV(color.hex, size);
                  if (!v) return <td key={size} className="px-2 py-2 text-center"><span className="text-muted-foreground/30">—</span></td>;
                  const on = enabledIds.has(v.id);
                  const oos = !v.isInStock;
                  return (
                    <td key={size} className="px-2 py-2 text-center">
                      <button
                        onClick={() => !oos && onToggle(v.id)}
                        className={`mx-auto flex h-6 w-6 items-center justify-center rounded-md border transition ${
                          on ? "border-primary bg-primary text-primary-foreground"
                          : oos ? "cursor-not-allowed border-border/20 bg-surface-elevated/20 text-muted-foreground/30"
                          : "border-border/50 bg-surface-elevated/40 hover:border-primary/60"
                        }`}
                      >
                        {on && <Check className="h-3 w-3" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {enabledIds.size} of {variants.length} variants enabled
      </p>
    </div>
  );
}

/**
 * FIXED: markup_price is now the actual currency amount (base * pct / 100)
 * retail_price = base_price + printCost + markup_price
 */
function PricingPreview({ basePrice, markupPct, printAreas, artworks, currencySymbol = "ETB" }: any) {
  const base = parseFloat(basePrice) || 0;
  const printCost = useMemo(() => {
    let total = 0;
    for (const area of printAreas) {
      const art = artworks[area.id];
      if (!art?.decalUrl) continue;
      const storeState = useStudioStore.getState();
      const selectedMethodCode = storeState.selectedMethods[area.id];
      const selectedTierSize = storeState.selectedTiers[area.id];
      const method = area.methods.find((m: PrintArea["methods"][0]) => m.code === selectedMethodCode) ?? area.methods[0];
      const tier = method?.tiers.find((t: PrintArea["methods"][0]["tiers"][0]) => t.size === selectedTierSize) ?? method?.tiers[0];
      if (tier) total += parseFloat(tier.price) || 0;
    }
    return total;
  }, [printAreas, artworks]);

  // FIXED: markup is calculated on base only, as actual currency amount
  const markupAmt = (base * markupPct) / 100;
  const retail = base + printCost + markupAmt;

  return (
    <div className="rounded-xl border border-border/40 bg-surface-elevated/30 p-3 space-y-2">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Estimated pricing</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground">Apparel base</span>
        <span className="text-right font-medium">{currencySymbol} {base.toFixed(2)}</span>
        {printCost > 0 && (
          <>
            <span className="text-muted-foreground">Print cost</span>
            <span className="text-right font-medium">{currencySymbol} {printCost.toFixed(2)}</span>
          </>
        )}
        <span className="text-muted-foreground">Your markup ({markupPct}%)</span>
        <span className="text-right font-medium">+{currencySymbol} {markupAmt.toFixed(2)}</span>
        <span className="col-span-2 border-t border-border/40 pt-1 font-semibold text-foreground flex justify-between">
          <span>Retail price</span>
          <span className="text-primary">{currencySymbol} {retail.toFixed(2)}</span>
        </span>
      </div>
    </div>
  );
}

function PrintAreaSummary({ printAreas, artworks }: any) {
  const active = printAreas.filter((p: PrintArea) => artworks[p.id]?.decalUrl);
  if (!active.length) return null;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Artwork areas</Label>
      {active.map((area: PrintArea) => {
        const tier = classifyPrintSize(area.widthCm, area.heightCm);
        return (
          <div key={area.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-surface-elevated/30 px-3 py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium">{area.name}</span>
              <span className="text-[10px] text-muted-foreground">{area.widthCm}×{area.heightCm}cm</span>
            </div>
            <Badge variant="secondary" className="h-5 text-[9px]">{TIER_LABELS[tier]}</Badge>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUCCESS SCREEN — Receives result directly as prop, no stale closure
// ═══════════════════════════════════════════════════════════════════════════════

interface SuccessResult {
  id?: string;
  public_link?: string;
  pricing?: {
    retail_price: string;
    currency: { code: string; symbol: string; name: string } | string;
  };
  thumbnail_url?: string;
  mockup_images?: Array<{ id: string; type: string; url: string; is_primary: boolean }>;
  title?: string;
}

function SuccessScreen({
  result,
  onDone,
  onShare,
}: {
  result: SuccessResult;
  onDone: () => void;
  onShare: () => void;
}) {
  const [selectedMockupId, setSelectedMockupId] = useState(() => {
    const primary = result.mockup_images?.find((m) => m.is_primary);
    return primary?.id ?? result.mockup_images?.[0]?.id ?? "";
  });

  const selectedMockup = result.mockup_images?.find((m) => m.id === selectedMockupId);
  const displayImage = selectedMockup?.url ?? result.thumbnail_url;

  return (
    <div className="flex flex-col">
      {/* Full-width mockup */}
      <div className="relative w-full bg-black">
        {displayImage ? (
          <img
            src={displayImage}
            alt={result.title || "Product"}
            className="h-auto w-full max-h-[50vh] object-contain mx-auto"
          />
        ) : (
          <div className="flex aspect-[4/5] w-full items-center justify-center bg-muted">
            <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}

        {/* Mockup dots */}
        {result.mockup_images && result.mockup_images.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {result.mockup_images.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMockupId(m.id)}
                className={`h-1.5 rounded-full transition-all ${
                  m.id === selectedMockupId ? "w-4 bg-white" : "w-1.5 bg-white/40"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-5 pt-5 pb-8 space-y-5">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-foreground leading-snug">
            {result.title || "Product Created"}
          </h2>
          {result.pricing && (
            <p className="text-[15px] text-muted-foreground">
              <span className="font-semibold text-foreground">
                {typeof result.pricing.currency === "object"
                  ? result.pricing.currency.symbol
                  : result.pricing.currency}{" "}
                {result.pricing.retail_price}
              </span>
              {" "}retail
            </p>
          )}
        </div>

        {/* Primary actions */}
        <div className="space-y-2.5">
          <Button
            onClick={onShare}
            className="w-full h-12 text-base font-semibold gap-2 rounded-2xl"
            size="lg"
          >
            <Send className="h-5 w-5" />
            Share Product
          </Button>
          <Button
            variant="ghost"
            onClick={onDone}
            className="w-full h-10 text-sm text-muted-foreground"
          >
            Skip — Go to Store
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DRAWER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function SaveProductDialog({
  shots: initialShots,
  snapshot,
  sheetId,
  variants,
  printAreas,
  artworks,
  baseApparelId,
  canvasBackground = "#ffffff",
  basePrice = "0",
}: Props) {
  const closeSheet = useOverlayStore((s) => s.closeSheet);
  const openSheet = useOverlayStore((s) => s.openSheet);
  const resetStore = useStudioStore((s) => s.reset);
  const navigate = useNavigate();
  const { openShareDrawer } = useShareDrawer();

  const [shots, setShots] = useState<ShotConfig[]>(initialShots);
  const [primaryShotId, setPrimaryShotId] = useState("front");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [markupPct, setMarkupPct] = useState(30);
  const [isLimited, setIsLimited] = useState(false);
  const [maxQty, setMaxQty] = useState(100);
  const [isProductionReady, setIsProductionReady] = useState(false);
  const [enabledIds, setEnabledIds] = useState<Set<string>>(
    () => new Set(variants.filter((v) => v.isInStock).map((v) => v.id)),
  );
  const [tab, setTab] = useState<"shots" | "variants" | "details">("shots");
  const [step, setStep] = useState<"form" | "submitting" | "success">("form");

  // Use a ref to always have the latest result without stale closures
  const resultRef = useRef<SuccessResult | null>(null);
  const successSheetIdRef = useRef<string>("");

  const store = useStudioStore();

  const toggleVariant = (id: string) =>
    setEnabledIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleShot = (id: string) =>
    setShots((prev) => prev.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s));

  const activeAreas = printAreas.filter((p) => artworks[p.id]?.decalUrl);

  const TABS = [
    { id: "shots" as const, label: "Shots" },
    { id: "variants" as const, label: "Variants" },
    { id: "details" as const, label: "Details" },
  ];

  const handleDone = useCallback(() => {
    closeSheet(sheetId);
    if (successSheetIdRef.current) {
      closeSheet(successSheetIdRef.current);
    }
    resetStore();
    navigate({ to: "/store" });
  }, [closeSheet, sheetId, resetStore, navigate]);

  // This function reads from the ref, so it's never stale
  const handleShareFromRef = useCallback(() => {
    const result = resultRef.current;
    if (!result) {
      toast.error("No product data available");
      return;
    }

    const primaryMockup = result.mockup_images?.find((m) => m.is_primary) ?? result.mockup_images?.[0];

    // Extract price and currency from result
    const price = result.pricing?.retail_price;
    const currencySymbol = typeof result.pricing?.currency === "object"
      ? result.pricing.currency.symbol
      : result.pricing?.currency;

    openShareDrawer({
      title: result.title || "My Custom Product",
      url: result.public_link || "",
      imageUrl: primaryMockup?.url ?? result.thumbnail_url,
      productId: result.id,
      shouldPublish: true,
      price,
      currencySymbol,
      flags: {
        isCustom: true,
        isPremium: true,
        isLimited: false,
        hasDiscount: false,
      },
    });
  }, [openShareDrawer]);

  const handleCreate = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (enabledIds.size === 0) { toast.error("Select at least one variant"); return; }
    if (activeAreas.length === 0) { toast.error("Add artwork to at least one print area"); return; }

    const enabledShots = shots.filter((s) => s.enabled && s.dataUrl);
    if (enabledShots.length === 0) { toast.error("At least one shot is required"); return; }

    setStep("submitting");

    try {
      const base = parseFloat(basePrice) || 0;

      // FIXED: markup_price is the actual currency amount (base * pct / 100)
      // NOT a percentage string. The backend expects a real value.
      const markupAmt = (base * markupPct) / 100;

      const printAreasPayload = activeAreas.map((area) => {
        const art = artworks[area.id];
        const selectedMethodCode = store.selectedMethods[area.id] ?? area.methods[0]?.code ?? "";
        const selectedTierSize = store.selectedTiers[area.id] ?? area.methods[0]?.tiers[0]?.size ?? "";
        const method = area.methods.find((m) => m.code === selectedMethodCode) ?? area.methods[0];
        const tier = method?.tiers.find((t) => t.size === selectedTierSize) ?? method?.tiers[0];

        return {
          print_area: area.areaKey,
          print_area_id: area.id,
          print_method: selectedMethodCode,
          width_cm: area.widthCm.toFixed(2),
          height_cm: area.heightCm.toFixed(2),
          color_count: 1,
          design_data: {
            layers: [{
              type: "image" as const,
              url: art.decalUrl,
              aspect_ratio: art.decalAspect,
              position: { x: art.decalOffsetX, y: art.decalOffsetY },
              offset_x: art.decalOffsetX,
              offset_y: art.decalOffsetY,
              scale: art.decalScale,
              rotation: art.decalRotation,
              z_index: 0,
            }],
          },
        };
      });

      const product = useStudioStore.getState().product;
      if (!product) { toast.error("Product data unavailable"); setStep("form"); return; }

      const cam = product.cameraConfig;
      const render = product.renderConfig;

      const renderConfig = {
        version: 3,
        background: canvasBackground,
        environment: render.environment,
        model_position: render.modelPosition,
        model_url: product.modelUrl,
        colorable_meshes: product.colorableMeshes,
        material: {
          texture_url: product.materialConfig.textureUrl,
          normal_map_url: product.materialConfig.normalMapUrl,
          roughness: product.materialConfig.roughness,
          metalness: product.materialConfig.metalness,
        },
        camera: {
          position: cam.position,
          fov: cam.fov,
          orbit: {
            min_distance: cam.orbit.minDistance,
            max_distance: cam.orbit.maxDistance,
            min_polar_angle: cam.orbit.minPolarAngle,
            max_polar_angle: cam.orbit.maxPolarAngle,
            enable_pan: cam.orbit.enablePan,
            enable_zoom: cam.orbit.enableZoom,
          },
        },
        lighting: (render as any).lighting,
        contact_shadows: {
          enabled: render.contactShadows.enabled,
          position: render.contactShadows.position,
          opacity: render.contactShadows.opacity,
          scale: render.contactShadows.scale,
          blur: render.contactShadows.blur,
          far: render.contactShadows.far,
        },
        shots: shots.map((s) => ({
          id: s.id,
          label: s.label,
          azimuth: s.azimuth,
          polar: s.polar,
          enabled: s.enabled,
        })),
        default_view: product.defaultView,
        print_areas: printAreas.map((area) => ({
          print_area_id: area.id,
          area_key: area.areaKey,
          name: area.name,
          placement: area.placement,
          mesh_name: area.meshName,
          width_cm: area.widthCm,
          height_cm: area.heightCm,
          uv_config: {
            world_bounds: area.worldBounds,
            uv_bounds: area.uvBounds
              ? { min_u: area.uvBounds.minU, min_v: area.uvBounds.minV, max_u: area.uvBounds.maxU, max_v: area.uvBounds.maxV }
              : undefined,
            transform_limits: area.transformLimits
              ? {
                  min_scale: area.transformLimits.minScale,
                  max_scale: area.transformLimits.maxScale,
                  min_x: area.transformLimits.minX,
                  max_x: area.transformLimits.maxX,
                  min_y: area.transformLimits.minY,
                  max_y: area.transformLimits.maxY,
                }
              : undefined,
          },
        })),
        artworkPrintInfos: activeAreas.map((area) => {
          const art = artworks[area.id];
          return {
            printAreaId: area.id,
            printAreaName: area.name,
            areaKey: area.areaKey,
            widthCm: area.widthCm,
            heightCm: area.heightCm,
            sizeTier: classifyPrintSize(area.widthCm, area.heightCm),
            decalUrl: art.decalUrl,
            decalAspect: art.decalAspect,
            decalScale: art.decalScale,
            decalRotation: art.decalRotation,
            decalOffsetX: art.decalOffsetX,
            decalOffsetY: art.decalOffsetY,
          };
        }),
      };

      toast.info("Creating product…");
      const created = await storeProductApi.create({
        title: title.trim(),
        description: description.trim(),
        base_apparel: baseApparelId,
        markup_price: markupAmt, // FIXED: now sends actual currency amount (number)
        print_areas: printAreasPayload,
        snapshot: {
          ...snapshot,
          artworkCount: activeAreas.length,
          artworkPrintInfos: activeAreas.map((area) => ({
            printAreaId: area.id,
            areaKey: area.areaKey,
            sizeTier: classifyPrintSize(area.widthCm, area.heightCm),
            widthCm: area.widthCm,
            heightCm: area.heightCm,
          })),
        },
        render_config: renderConfig,
        enabled_variants: [...enabledIds],
        is_limited_edition: isLimited,
        max_quantity: isLimited ? maxQty : null,
        production_ready: isProductionReady,
      });

      toast.info("Uploading mockup images…");
      const blobs = await Promise.all(
        enabledShots.map(async (shot) => ({
          blob: await blobFromDataUrl(shot.dataUrl!),
          type: shot.id,
          name: `mockup-${shot.id}.png`,
        })),
      );

      const assetsData = await storeProductApi.uploadAssets(created.id, blobs);

      const finalResult: SuccessResult = {
        ...created,
        title: title.trim(),
        thumbnail_url: assetsData.thumbnail_url || created.thumbnail_url,
        mockup_images: assetsData.mockups,
      };

      // Store in ref BEFORE opening the sheet so the callback can access it
      resultRef.current = finalResult;

      // Close form drawer and open success sheet
      closeSheet(sheetId);

      const successSheetId = openSheet({
        title: null,
        content: (
          <SuccessScreen
            result={finalResult}
            onDone={() => {
              closeSheet(successSheetId);
              handleDone();
            }}
            onShare={handleShareFromRef}
          />
        ),
        dismissible: false,
      });

      successSheetIdRef.current = successSheetId;
      setStep("success");
      toast.success("Product created!");
    } catch (err: any) {
      const detail = err?.data?.error?.message ?? err?.message ?? "Failed to create product";
      console.error(detail);
      toast.error(detail);
      setStep("form");
    }
  };

  const isSubmitting = step === "submitting";

  return (
    <div className="flex flex-col gap-0">
      <div className="mb-4 flex rounded-xl border border-border/40 bg-surface-elevated/30 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
              tab === t.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "shots" && (
          <motion.div key="shots" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-8">
              <HeroMockup shots={shots} primaryShotId={primaryShotId} onSetPrimary={setPrimaryShotId} onToggle={toggleShot} canvasBackground={canvasBackground} />
              <PrintAreaSummary printAreas={printAreas} artworks={artworks} />
              {activeAreas.length === 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">No artwork applied yet.</p>
                </div>
              )}
            </div>
            <Button className="w-full" onClick={() => setTab("variants")} variant="outline">
              Next: Variants <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </motion.div>
        )}

        {tab === "variants" && (
          <motion.div key="variants" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} className="space-y-4">
            <VariantMatrix variants={variants} enabledIds={enabledIds} onToggle={toggleVariant} />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTab("shots")} className="flex-1">
                <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Shots
              </Button>
              <Button onClick={() => setTab("details")} className="flex-1">
                Next: Details <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
        )}

        {tab === "details" && (
          <motion.div key="details" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-title">Title *</Label>
              <Input id="p-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Eclipse Tee · Vol. 01" disabled={isSubmitting} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-desc">Description</Label>
              <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A few words about this drop…" rows={3} disabled={isSubmitting} />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="p-markup">Your markup</Label>
                <span className="text-xs font-medium">{markupPct}%</span>
              </div>
              <input
                id="p-markup"
                type="range"
                min={0}
                max={200}
                step={1}
                value={markupPct}
                onChange={(e) => setMarkupPct(Number(e.target.value))}
                disabled={isSubmitting}
                className="w-full accent-primary"
              />
              <PricingPreview basePrice={basePrice} markupPct={markupPct} printAreas={printAreas} artworks={artworks} />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-surface-elevated/40 p-3">
              <div>
                <p className="text-sm font-medium">Limited edition</p>
                <p className="text-xs text-muted-foreground">Cap total units</p>
              </div>
              <Switch checked={isLimited} onCheckedChange={setIsLimited} disabled={isSubmitting} />
            </div>
            {isLimited && (
              <div className="space-y-1.5">
                <Label htmlFor="p-max">Max quantity</Label>
                <Input id="p-max" type="number" min={1} value={maxQty} onChange={(e) => setMaxQty(Number(e.target.value))} disabled={isSubmitting} />
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-surface-elevated/40 p-3">
              <div className="flex items-center gap-2">
                <PackageCheck className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Production ready</p>
                  <p className="text-xs text-muted-foreground">Approve for fulfillment</p>
                </div>
              </div>
              <Switch checked={isProductionReady} onCheckedChange={setIsProductionReady} disabled={isSubmitting} />
            </div>

            <div className="rounded-xl border border-border/40 bg-surface-elevated/30 px-3 py-2 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">{shots.filter((s) => s.enabled).length}</span> shots ·{" "}
              <span className="font-medium text-foreground">{enabledIds.size}</span> variants ·{" "}
              <span className="font-medium text-foreground">{activeAreas.length}</span> artwork{activeAreas.length !== 1 ? "s" : ""}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setTab("variants")} disabled={isSubmitting} className="flex-1">
                <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Back
              </Button>
              <Button onClick={handleCreate} disabled={isSubmitting} className="flex-1">
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Saving…</>
                ) : (
                  <><CloudUpload className="mr-2 h-3.5 w-3.5" /> Save</>
                )}
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => closeSheet(sheetId)} disabled={isSubmitting}>
              Cancel
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
