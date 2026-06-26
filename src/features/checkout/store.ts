// src/features/checkout/store.ts — v6
/**
 * Final version. Key fix in loadDesign:
 *   - Artworks read from detail.render_config.artworkPrintInfos[]
 *     (real saved shape) not from snapshot.artworks
 *   - Pre-selects variant/color/size from enabled_variant[0]
 *     (snapshot doesn't store selectedVariantId explicitly)
 *   - All StepShipping fields present: cities, citiesLoading,
 *     shippingLoading, clearFieldError, setSelectedVendorCode, setSelectedPickupId
 */

import { create } from "zustand";
import type { ArtworkState, PrintArea, ApparelProduct } from "@/features/studio/store";
import type {
  CheckoutStep,
  CheckoutVariant,
  CheckoutItem,
  City,
  ShippingAddress,
  ShippingOptions,
  FulfillmentType,
  OrderResponse,
  ReceiptSubmission,
  VerificationStatus,
  FieldErrors,
  VariantSelection,
} from "./types";
import type { ProductDetail } from "@/features/store/api";

// ─── Open params ──────────────────────────────────────────────────────────────

export interface CheckoutOpenParams {
  productId: string;
  productName: string;
  thumbnailUrl?: string;
  mockupUrl?: string;
  basePrice: number;
  printCost: number;
  currencySymbol: string;
  variants: CheckoutVariant[];
  artworks: Record<string, ArtworkState>;
  printAreas: PrintArea[];
  selectedColor?: string;
  preselectedVariantId?: string;
  userFullName?: string;
  mockupUrls?: string[];
}

// ─── State interface ──────────────────────────────────────────────────────────

export interface CheckoutState {
  isOpen: boolean;
  step: CheckoutStep;
  direction: number;

  productId: string;
  productName: string;
  thumbnailUrl?: string;
  mockupUrl?: string;
  mockupUrls: string[];

  variants: CheckoutVariant[];
  selectedColors: Set<string>;
  selectedSizes: Set<string>;
  selectedVariants: Map<string, VariantSelection>;

  artworks: Record<string, ArtworkState>;
  printAreas: PrintArea[];

  basePrice: number;
  printCost: number;
  currencySymbol: string;

  shippingAddress: ShippingAddress;
  fulfillmentType: FulfillmentType;
  cities: City[];
  citiesLoading: boolean;
  shippingOptions: ShippingOptions | null;
  shippingLoading: boolean;
  selectedVendorCode: string;
  selectedPickupId: string;
  couponCode: string;

  order: OrderResponse | null;
  creatingOrder: boolean;
  fieldErrors: FieldErrors;

  selectedProviderCode: string;
  receiptIdentifier: string;
  payerAccount: string;
  submittingReceipt: boolean;
  txRef: string;
  verifyState: VerificationStatus | null;
  pollInterval: ReturnType<typeof setInterval> | null;
  receiptSubmission: ReceiptSubmission | null;

  open: (params: CheckoutOpenParams) => void;
  reset: () => void;
  goBack: () => void;
  goForward: () => void;
  saveDraft: () => void;

  toggleColor: (hex: string) => void;
  toggleSize: (size: string) => void;
  setVariantQuantity: (variantId: string, qty: number) => void;
  getSelectedVariants: () => VariantSelection[];
  getTotalQuantity: () => number;
  getOrderItems: () => CheckoutItem[];

  setShippingAddress: (addr: Partial<ShippingAddress>) => void;
  setFulfillmentType: (type: FulfillmentType) => void;
  setCities: (cities: City[]) => void;
  setCitiesLoading: (v: boolean) => void;
  setShippingOptions: (opts: ShippingOptions | null) => void;
  setShippingLoading: (v: boolean) => void;
  setSelectedVendor: (code: string) => void;
  setSelectedVendorCode: (code: string) => void;
  setSelectedPickup: (id: string) => void;
  setSelectedPickupId: (id: string) => void;
  setCouponCode: (code: string) => void;

  setOrder: (order: OrderResponse) => void;
  setCreatingOrder: (v: boolean) => void;
  setFieldErrors: (errs: FieldErrors) => void;
  clearFieldError: (key: keyof FieldErrors) => void;

  setSelectedProviderCode: (code: string) => void;
  setReceiptIdentifier: (v: string) => void;
  setPayerAccount: (v: string) => void;
  setSubmittingReceipt: (v: boolean) => void;
  setTxRef: (v: string) => void;
  setVerifyState: (v: VerificationStatus | null) => void;
  setPollInterval: (v: ReturnType<typeof setInterval> | null) => void;
  setReceiptSubmission: (v: ReceiptSubmission | null) => void;

  loadDesign: (detail: ProductDetail, apparelProduct: ApparelProduct) => void;
  _rebuildSelections: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STEPS: CheckoutStep[] = ["variants", "shipping", "review", "payment"];

function defaultAddress(): ShippingAddress {
  return {
    fullName: "", phone: "", street: "",
    cityId: "", cityName: "", state: "",
    postalCode: "", deliveryInstructions: "",
  };
}

const blank = {
  isOpen: false,
  step: "variants" as CheckoutStep,
  direction: 1,
  productId: "",
  productName: "",
  thumbnailUrl: undefined as string | undefined,
  mockupUrl: undefined as string | undefined,
  mockupUrls: [] as string[],
  variants: [] as CheckoutVariant[],
  selectedColors: new Set<string>(),
  selectedSizes: new Set<string>(),
  selectedVariants: new Map<string, VariantSelection>(),
  artworks: {} as Record<string, ArtworkState>,
  printAreas: [] as PrintArea[],
  basePrice: 0,
  printCost: 0,
  currencySymbol: "Br",
  shippingAddress: defaultAddress(),
  fulfillmentType: "delivery" as FulfillmentType,
  cities: [] as City[],
  citiesLoading: false,
  shippingOptions: null as ShippingOptions | null,
  shippingLoading: false,
  selectedVendorCode: "",
  selectedPickupId: "",
  couponCode: "",
  order: null as OrderResponse | null,
  creatingOrder: false,
  fieldErrors: {} as FieldErrors,
  selectedProviderCode: "",
  receiptIdentifier: "",
  payerAccount: "",
  submittingReceipt: false,
  txRef: "",
  verifyState: null as VerificationStatus | null,
  pollInterval: null as ReturnType<typeof setInterval> | null,
  receiptSubmission: null as ReceiptSubmission | null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCheckoutStore = create<CheckoutState>((set, get) => ({
  ...blank,

  // ── open ───────────────────────────────────────────────────────────────────
  open: ({
    productId, productName, thumbnailUrl, mockupUrl, mockupUrls = [],
    basePrice, printCost, currencySymbol, variants, artworks, printAreas,
    selectedColor, preselectedVariantId, userFullName,
  }) => {
    const initialColors    = new Set<string>();
    const initialSizes     = new Set<string>();
    const initialSelections = new Map<string, VariantSelection>();

    if (preselectedVariantId) {
      const v = variants.find((v) => v.id === preselectedVariantId);
      if (v) {
        initialColors.add(v.color.hex);
        initialSizes.add(v.size);
        initialSelections.set(v.id, {
          variantId: v.id, colorHex: v.color.hex,
          colorName: v.color.name, size: v.size, quantity: 1,
        });
      }
    } else if (selectedColor) {
      initialColors.add(selectedColor);
    }

    set({
      ...blank,
      cities: get().cities, // keep city list
      isOpen: true,
      step: "variants",
      direction: 1,
      productId, productName, thumbnailUrl, mockupUrl,
      mockupUrls, basePrice, printCost, currencySymbol,
      variants, artworks, printAreas,
      selectedColors: initialColors,
      selectedSizes: initialSizes,
      selectedVariants: initialSelections,
      shippingAddress: userFullName
        ? { ...defaultAddress(), fullName: userFullName }
        : defaultAddress(),
    });
  },

  // ── loadDesign ─────────────────────────────────────────────────────────────
  // Hydrates checkout from a saved ProductDetail for the reorder flow.
  // Artworks come from detail.render_config.artworkPrintInfos[].
  // Variant pre-selection comes from detail.enabled_variant[0].
  loadDesign: (detail, apparelProduct) => {
    const rc = (detail as any).render_config ?? {};

    // ── Artworks from artworkPrintInfos ──────────────────────────────────────
    const artworkInfos: any[] = rc.artworkPrintInfos ?? [];
    const artworks: Record<string, ArtworkState> = {};
    for (const info of artworkInfos) {
      if (!info.decalUrl) continue;
      artworks[info.printAreaId] = {
        decalUrl:      info.decalUrl,
        decalAspect:   info.decalAspect   ?? 1,
        decalScale:    info.decalScale    ?? 0.5,
        decalRotation: info.decalRotation ?? 0,
        decalOffsetX:  info.decalOffsetX  ?? 0,
        decalOffsetY:  info.decalOffsetY  ?? 0,
      };
    }

    // ── Variants ─────────────────────────────────────────────────────────────
    const variants: CheckoutVariant[] = (detail.enabled_variant ?? []).map((v: any) => ({
      id:              v.id,
      sku:             v.sku ?? "",
      color:           v.color,
      size:            v.size,
      stockQuantity:   v.stock_quantity ?? 99,
      isInStock:       v.is_in_stock ?? v.isInStock ?? true,
      additionalPrice: "0",
      quantity:        1,
    }));

    // ── Mockup URLs from sorted mockups ───────────────────────────────────────
    const mockupUrls = ((detail as any).mockups ?? [])
      .slice()
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((m: any) => m.url);

    // ── Pre-select first variant ──────────────────────────────────────────────
    const initialColors    = new Set<string>();
    const initialSizes     = new Set<string>();
    const initialSelections = new Map<string, VariantSelection>();

    const firstV = variants[0];
    if (firstV) {
      initialColors.add(firstV.color.hex);
      initialSizes.add(firstV.size);
      initialSelections.set(firstV.id, {
        variantId: firstV.id,
        colorHex:  firstV.color.hex,
        colorName: firstV.color.name,
        size:      firstV.size,
        quantity:  1,
      });
    }

    const pricing       = (detail as any).pricing ?? {};
    const sym           = typeof pricing.currency === "object"
      ? pricing.currency.symbol : "Br";
    const basePrice     = parseFloat(pricing.base_price ?? "0");

    set({
      ...blank,
      cities: get().cities,
      isOpen: true,
      step: "variants",
      direction: 1,
      productId:     detail.id,
      productName:   detail.title,
      thumbnailUrl:  (detail as any).thumbnail_url,
      mockupUrl:     mockupUrls[0],
      mockupUrls,
      basePrice,
      printCost:     0,   // already baked into retail_price for saved designs
      currencySymbol: sym,
      variants,
      selectedColors:   initialColors,
      selectedSizes:    initialSizes,
      selectedVariants: initialSelections,
      artworks,
      printAreas: apparelProduct.printAreas,
    });
  },

  // ── Navigation ──────────────────────────────────────────────────────────────
  reset: () => {
    const { pollInterval, cities } = get();
    if (pollInterval) clearInterval(pollInterval);
    set({ ...blank, cities, selectedColors: new Set(), selectedSizes: new Set(), selectedVariants: new Map() });
  },

  goBack: () => {
    const idx = STEPS.indexOf(get().step);
    if (idx > 0) set({ step: STEPS[idx - 1], direction: -1 });
  },

  goForward: () => {
    const idx = STEPS.indexOf(get().step);
    if (idx < STEPS.length - 1) set({ step: STEPS[idx + 1], direction: 1 });
  },

  saveDraft: () => {
    const s = get();
    try {
      localStorage.setItem("checkout_draft", JSON.stringify({
        productId: s.productId, productName: s.productName,
        step: s.step, artworks: s.artworks, shippingAddress: s.shippingAddress,
      }));
    } catch { /* storage unavailable */ }
  },

  // ── Variant selection ───────────────────────────────────────────────────────
  toggleColor: (hex) => {
    set((s) => {
      const next = new Set(s.selectedColors);
      if (next.has(hex)) {
        next.delete(hex);
        const newSel = new Map(s.selectedVariants);
        for (const [id, sel] of newSel) { if (sel.colorHex === hex) newSel.delete(id); }
        return { selectedColors: next, selectedVariants: newSel };
      }
      next.add(hex);
      return { selectedColors: next };
    });
    get()._rebuildSelections();
  },

  toggleSize: (size) => {
    set((s) => {
      const next = new Set(s.selectedSizes);
      if (next.has(size)) {
        next.delete(size);
        const newSel = new Map(s.selectedVariants);
        for (const [id, sel] of newSel) { if (sel.size === size) newSel.delete(id); }
        return { selectedSizes: next, selectedVariants: newSel };
      }
      next.add(size);
      return { selectedSizes: next };
    });
    get()._rebuildSelections();
  },

  _rebuildSelections: () => {
    const { variants, selectedColors, selectedSizes, selectedVariants } = get();
    const newSel = new Map(selectedVariants);
    for (const color of selectedColors) {
      for (const size of selectedSizes) {
        const v = variants.find((v) => v.color.hex === color && v.size === size && v.isInStock);
        if (v && !newSel.has(v.id)) {
          newSel.set(v.id, { variantId: v.id, colorHex: v.color.hex,
            colorName: v.color.name, size: v.size, quantity: 1 });
        }
      }
    }
    set({ selectedVariants: newSel });
  },

  setVariantQuantity: (variantId, qty) => {
    set((s) => {
      if (qty <= 0) {
        const next = new Map(s.selectedVariants); next.delete(variantId);
        return { selectedVariants: next };
      }
      const sel = s.selectedVariants.get(variantId);
      if (!sel) return s;
      const next = new Map(s.selectedVariants);
      next.set(variantId, { ...sel, quantity: qty });
      return { selectedVariants: next };
    });
  },

  getSelectedVariants: () => Array.from(get().selectedVariants.values()),
  getTotalQuantity: () =>
    Array.from(get().selectedVariants.values()).reduce((s, v) => s + v.quantity, 0),

  getOrderItems: (): CheckoutItem[] => {
    const { productId, selectedVariants, artworks, printAreas, basePrice, printCost } = get();
    return Array.from(selectedVariants.values()).map((sel) => ({
      productId,
      variantId:  sel.variantId,
      size:       sel.size,
      colorName:  sel.colorName,
      colorHex:   sel.colorHex,
      quantity:   sel.quantity,
      unitPrice:  basePrice + printCost,
      printAreas: printAreas
        .filter((p) => artworks[p.id]?.decalUrl)
        .map((p) => ({ areaId: p.id, areaName: p.name, artwork: artworks[p.id] })),
    }));
  },

  // ── Shipping ────────────────────────────────────────────────────────────────
  setShippingAddress:  (addr) => set((s) => ({ shippingAddress: { ...s.shippingAddress, ...addr } })),
  setFulfillmentType:  (type) => set({ fulfillmentType: type }),
  setCities:           (cities) => set({ cities }),
  setCitiesLoading:    (v) => set({ citiesLoading: v }),
  setShippingOptions:  (opts) => set({ shippingOptions: opts }),
  setShippingLoading:  (v) => set({ shippingLoading: v }),
  setSelectedVendor:     (code) => set({ selectedVendorCode: code }),
  setSelectedVendorCode: (code) => set({ selectedVendorCode: code }),
  setSelectedPickup:     (id)   => set({ selectedPickupId: id }),
  setSelectedPickupId:   (id)   => set({ selectedPickupId: id }),
  setCouponCode:         (code) => set({ couponCode: code }),

  // ── Order ───────────────────────────────────────────────────────────────────
  setOrder:          (order) => set({ order }),
  setCreatingOrder:  (v) => set({ creatingOrder: v }),
  setFieldErrors:    (errs) => set({ fieldErrors: errs }),
  clearFieldError:   (key) => set((s) => { const n = { ...s.fieldErrors }; delete n[key]; return { fieldErrors: n }; }),

  // ── Payment ──────────────────────────────────────────────────────────────────
  setSelectedProviderCode: (code) => set({ selectedProviderCode: code }),
  setReceiptIdentifier:    (v)    => set({ receiptIdentifier: v }),
  setPayerAccount:         (v)    => set({ payerAccount: v }),
  setSubmittingReceipt:    (v)    => set({ submittingReceipt: v }),
  setTxRef:                (v)    => set({ txRef: v }),
  setVerifyState:          (v)    => set({ verifyState: v }),
  setPollInterval:         (v)    => set({ pollInterval: v }),
  setReceiptSubmission:    (v)    => set({ receiptSubmission: v }),
}));