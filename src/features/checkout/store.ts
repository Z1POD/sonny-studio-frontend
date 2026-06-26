// src/features/checkout/store.ts — v5
/**
 * Complete checkout store.
 * Fixes v4 omissions:
 *   - cities / setCities / citiesLoading / setCitiesLoading
 *   - shippingLoading / setShippingLoading
 *   - setSelectedVendorCode / setSelectedPickupId (aliases)
 *   - clearFieldError
 * All fields consumed by StepShipping, StepVariantQuantity, StepReview,
 * StepPayment are present.
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
  // UI
  isOpen: boolean;
  step: CheckoutStep;
  direction: number;

  // Product
  productId: string;
  productName: string;
  thumbnailUrl?: string;
  mockupUrl?: string;
  mockupUrls: string[];

  // Variants
  variants: CheckoutVariant[];
  selectedColors: Set<string>;
  selectedSizes: Set<string>;
  selectedVariants: Map<string, VariantSelection>;

  // Artwork / print areas
  artworks: Record<string, ArtworkState>;
  printAreas: PrintArea[];

  // Pricing
  basePrice: number;
  printCost: number;
  currencySymbol: string;

  // Shipping
  shippingAddress: ShippingAddress;
  fulfillmentType: FulfillmentType;
  cities: City[];
  citiesLoading: boolean;
  shippingOptions: ShippingOptions | null;
  shippingLoading: boolean;
  selectedVendorCode: string;
  selectedPickupId: string;
  couponCode: string;

  // Order
  order: OrderResponse | null;
  creatingOrder: boolean;
  fieldErrors: FieldErrors;

  // Payment
  selectedProviderCode: string;
  receiptIdentifier: string;
  payerAccount: string;
  submittingReceipt: boolean;
  txRef: string;
  verifyState: VerificationStatus | null;
  pollInterval: ReturnType<typeof setInterval> | null;
  receiptSubmission: ReceiptSubmission | null;

  // ─── Actions ───────────────────────────────────────────────────────────────

  open: (params: CheckoutOpenParams) => void;
  reset: () => void;
  goBack: () => void;
  goForward: () => void;
  saveDraft: () => void;

  // Variants step
  toggleColor: (hex: string) => void;
  toggleSize: (size: string) => void;
  setVariantQuantity: (variantId: string, qty: number) => void;
  getSelectedVariants: () => VariantSelection[];
  getTotalQuantity: () => number;
  getOrderItems: () => CheckoutItem[];

  // Shipping step
  setShippingAddress: (addr: Partial<ShippingAddress>) => void;
  setFulfillmentType: (type: FulfillmentType) => void;
  setCities: (cities: City[]) => void;
  setCitiesLoading: (v: boolean) => void;
  setShippingOptions: (opts: ShippingOptions | null) => void;
  setShippingLoading: (v: boolean) => void;
  // Both names used across StepShipping
  setSelectedVendor: (code: string) => void;
  setSelectedVendorCode: (code: string) => void;
  setSelectedPickup: (id: string) => void;
  setSelectedPickupId: (id: string) => void;
  setCouponCode: (code: string) => void;

  // Order
  setOrder: (order: OrderResponse) => void;
  setCreatingOrder: (v: boolean) => void;
  setFieldErrors: (errs: FieldErrors) => void;
  clearFieldError: (key: keyof FieldErrors) => void;

  // Payment
  setSelectedProviderCode: (code: string) => void;
  setReceiptIdentifier: (v: string) => void;
  setPayerAccount: (v: string) => void;
  setSubmittingReceipt: (v: boolean) => void;
  setTxRef: (v: string) => void;
  setVerifyState: (v: VerificationStatus | null) => void;
  setPollInterval: (v: ReturnType<typeof setInterval> | null) => void;
  setReceiptSubmission: (v: ReceiptSubmission | null) => void;

  /** Hydrate from a saved ProductDetail for the reorder / studio-restore flow */
  loadDesign: (detail: ProductDetail, apparelProduct: ApparelProduct) => void;

  /** @internal — rebuild selectedVariants after color/size toggle */
  _rebuildSelections: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STEPS: CheckoutStep[] = ["variants", "shipping", "review", "payment"];

function defaultAddress(): ShippingAddress {
  return {
    fullName: "",
    phone: "",
    street: "",
    cityId: "",
    cityName: "",
    state: "",
    postalCode: "",
    deliveryInstructions: "",
  };
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initial = {
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
  ...initial,

  // ── open ───────────────────────────────────────────────────────────────────
  open: ({
    productId, productName, thumbnailUrl, mockupUrl, mockupUrls = [],
    basePrice, printCost, currencySymbol, variants, artworks, printAreas,
    selectedColor, preselectedVariantId, userFullName,
  }) => {
    const initialColors = new Set<string>();
    const initialSizes = new Set<string>();
    const initialSelections = new Map<string, VariantSelection>();

    if (preselectedVariantId) {
      const v = variants.find((v) => v.id === preselectedVariantId);
      if (v) {
        initialColors.add(v.color.hex);
        initialSizes.add(v.size);
        initialSelections.set(v.id, {
          variantId: v.id,
          colorHex: v.color.hex,
          colorName: v.color.name,
          size: v.size,
          quantity: 1,
        });
      }
    } else if (selectedColor) {
      initialColors.add(selectedColor);
    }

    set({
      ...initial,
      isOpen: true,
      step: "variants",
      direction: 1,
      productId,
      productName,
      thumbnailUrl,
      mockupUrl,
      mockupUrls,
      basePrice,
      printCost,
      currencySymbol,
      variants,
      selectedColors: initialColors,
      selectedSizes: initialSizes,
      selectedVariants: initialSelections,
      artworks,
      printAreas,
      shippingAddress: userFullName
        ? { ...defaultAddress(), fullName: userFullName }
        : defaultAddress(),
    });
  },

  // ── loadDesign ─────────────────────────────────────────────────────────────
  loadDesign: (detail, apparelProduct) => {
    const pricing = detail.pricing;
    const sym =
      typeof pricing?.currency === "object" ? pricing.currency.symbol : "Br";
    const basePrice = parseFloat(pricing?.base_price ?? "0");

    const variants: CheckoutVariant[] = (detail.enabled_variant ?? []).map((v) => ({
      id: v.id,
      sku: v.sku,
      color: v.color,
      size: v.size,
      stockQuantity: (v as any).stock_quantity ?? 99,
      isInStock: (v as any).isInStock ?? (v as any).in_stock ?? true,
      additionalPrice: "0",
      quantity: 1,
    }));

    const snapshot = detail.snapshot as any;
    const savedArtworks: Record<string, ArtworkState> = snapshot?.artworks ?? {};
    const savedColor: string | null = snapshot?.selectedColor ?? apparelProduct.colors[0] ?? null;
    const savedVariantId: string | null =
      snapshot?.selectedVariantId ?? variants[0]?.id ?? null;

    const mockupUrls = (detail.mockups ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => m.url);

    const initialColors = new Set<string>();
    const initialSizes = new Set<string>();
    const initialSelections = new Map<string, VariantSelection>();

    if (savedVariantId) {
      const v = variants.find((v) => v.id === savedVariantId);
      if (v) {
        initialColors.add(v.color.hex);
        initialSizes.add(v.size);
        initialSelections.set(v.id, {
          variantId: v.id,
          colorHex: v.color.hex,
          colorName: v.color.name,
          size: v.size,
          quantity: 1,
        });
      }
    } else if (savedColor) {
      initialColors.add(savedColor);
    }

    set({
      ...initial,
      isOpen: true,
      step: "variants",
      direction: 1,
      productId: detail.id,
      productName: detail.title,
      thumbnailUrl: detail.thumbnail_url,
      mockupUrl: mockupUrls[0],
      mockupUrls,
      basePrice,
      printCost: 0,
      currencySymbol: sym,
      variants,
      selectedColors: initialColors,
      selectedSizes: initialSizes,
      selectedVariants: initialSelections,
      artworks: savedArtworks,
      printAreas: apparelProduct.printAreas,
    });
  },

  // ── Navigation ──────────────────────────────────────────────────────────────
  reset: () => {
    const { pollInterval } = get();
    if (pollInterval) clearInterval(pollInterval);
    set({
      ...initial,
      selectedColors: new Set(),
      selectedSizes: new Set(),
      selectedVariants: new Map(),
      cities: get().cities, // keep cities — no need to refetch
    });
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
      localStorage.setItem(
        "checkout_draft",
        JSON.stringify({
          productId: s.productId,
          productName: s.productName,
          step: s.step,
          artworks: s.artworks,
          shippingAddress: s.shippingAddress,
        }),
      );
    } catch { /* storage unavailable */ }
  },

  // ── Variant selection ───────────────────────────────────────────────────────
  toggleColor: (hex) => {
    set((s) => {
      const next = new Set(s.selectedColors);
      if (next.has(hex)) {
        next.delete(hex);
        const newSel = new Map(s.selectedVariants);
        for (const [id, sel] of newSel) {
          if (sel.colorHex === hex) newSel.delete(id);
        }
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
        for (const [id, sel] of newSel) {
          if (sel.size === size) newSel.delete(id);
        }
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
        const variant = variants.find(
          (v) => v.color.hex === color && v.size === size && v.isInStock,
        );
        if (variant && !newSel.has(variant.id)) {
          newSel.set(variant.id, {
            variantId: variant.id,
            colorHex: variant.color.hex,
            colorName: variant.color.name,
            size: variant.size,
            quantity: 1,
          });
        }
      }
    }
    set({ selectedVariants: newSel });
  },

  setVariantQuantity: (variantId, qty) => {
    set((s) => {
      if (qty <= 0) {
        const next = new Map(s.selectedVariants);
        next.delete(variantId);
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
      variantId: sel.variantId,
      size: sel.size,
      colorName: sel.colorName,
      colorHex: sel.colorHex,
      quantity: sel.quantity,
      unitPrice: basePrice + printCost,
      printAreas: printAreas
        .filter((p) => artworks[p.id]?.decalUrl)
        .map((p) => ({
          areaId: p.id,
          areaName: p.name,
          artwork: artworks[p.id],
        })),
    }));
  },

  // ── Shipping ────────────────────────────────────────────────────────────────
  setShippingAddress: (addr) =>
    set((s) => ({ shippingAddress: { ...s.shippingAddress, ...addr } })),
  setFulfillmentType: (type) => set({ fulfillmentType: type }),
  setCities: (cities) => set({ cities }),
  setCitiesLoading: (v) => set({ citiesLoading: v }),
  setShippingOptions: (opts) => set({ shippingOptions: opts }),
  setShippingLoading: (v) => set({ shippingLoading: v }),
  // Both naming conventions used across components
  setSelectedVendor: (code) => set({ selectedVendorCode: code }),
  setSelectedVendorCode: (code) => set({ selectedVendorCode: code }),
  setSelectedPickup: (id) => set({ selectedPickupId: id }),
  setSelectedPickupId: (id) => set({ selectedPickupId: id }),
  setCouponCode: (code) => set({ couponCode: code }),

  // ── Order ───────────────────────────────────────────────────────────────────
  setOrder: (order) => set({ order }),
  setCreatingOrder: (v) => set({ creatingOrder: v }),
  setFieldErrors: (errs) => set({ fieldErrors: errs }),
  clearFieldError: (key) =>
    set((s) => {
      const next = { ...s.fieldErrors };
      delete next[key];
      return { fieldErrors: next };
    }),

  // ── Payment ──────────────────────────────────────────────────────────────────
  setSelectedProviderCode: (code) => set({ selectedProviderCode: code }),
  setReceiptIdentifier: (v) => set({ receiptIdentifier: v }),
  setPayerAccount: (v) => set({ payerAccount: v }),
  setSubmittingReceipt: (v) => set({ submittingReceipt: v }),
  setTxRef: (v) => set({ txRef: v }),
  setVerifyState: (v) => set({ verifyState: v }),
  setPollInterval: (v) => set({ pollInterval: v }),
  setReceiptSubmission: (v) => set({ receiptSubmission: v }),
}));