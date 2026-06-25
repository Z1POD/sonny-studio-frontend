// src/features/checkout/store.ts

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  CheckoutDraft,
  CheckoutStep,
  CheckoutVariant,
  City,
  DeliveryOption,
  FieldErrors,
  FulfillmentType,
  InvoiceData,
  OrderResponse,
  PickupLocation,
  ShippingAddress,
  VariantSelection,
  VerificationStatus,
} from "./types";

// ─── Checkout State ─────────────────────────────────────────────────────────

interface CheckoutState {
  // Flow state
  isOpen: boolean;
  step: CheckoutStep;
  direction: number;

  // Product data
  productId: string;
  productName: string;
  thumbnailUrl?: string;
  mockupUrl?: string;
  basePrice: number;
  printCost: number;
  currencySymbol: string;

  // Variants & artwork
  variants: CheckoutVariant[];
  artworks: Record<string, { decalUrl: string; decalAspect: number; decalScale: number; decalRotation: number; decalOffsetX: number; decalOffsetY: number }>;
  printAreas: Array<{ id: string; name: string; widthCm: number; heightCm: number; areaKey: string }>;

  // Step 1: Multi-variant selection (NEW)
  selectedVariants: Map<string, VariantSelection>; // variantId -> selection
  selectedColors: Set<string>; // hex values
  selectedSizes: Set<string>; // size values

  // Step 2: Shipping
  shippingAddress: ShippingAddress;
  fulfillmentType: FulfillmentType;
  selectedVendorCode: string;
  selectedPickupId: string;
  cities: City[];
  citiesLoading: boolean;
  shippingOptions: { delivery: DeliveryOption[]; pickup: PickupLocation[] } | null;
  shippingLoading: boolean;
  couponCode: string;

  // Step 3: Review / Order
  order: OrderResponse | null;
  creatingOrder: boolean;

  // Step 4: Payment
  selectedProviderCode: string;
  receiptIdentifier: string;
  payerAccount: string;
  submittingReceipt: boolean;
  txRef: string;
  verifyState: VerificationStatus | null;
  pollInterval: number | null;

  // Validation
  fieldErrors: FieldErrors;

  // Drafts
  drafts: CheckoutDraft[];

  // ─── Actions ──────────────────────────────────────────────────────────────
  open: (config: {
    productId: string;
    productName: string;
    thumbnailUrl?: string;
    mockupUrl?: string;
    basePrice: number;
    printCost?: number;
    currencySymbol: string;
    variants: CheckoutVariant[];
    artworks: Record<string, { decalUrl: string; decalAspect: number; decalScale: number; decalRotation: number; decalOffsetX: number; decalOffsetY: number }>;
    printAreas: Array<{ id: string; name: string; widthCm: number; heightCm: number; areaKey: string }>;
    selectedColor?: string;
    preselectedVariantId?: string;
    userFullName?: string;
  }) => void;
  close: () => void;
  setStep: (step: CheckoutStep, direction?: number) => void;
  goBack: () => void;
  goForward: () => void;

  // Step 1 actions (NEW multi-variant)
  toggleColor: (hex: string) => void;
  toggleSize: (size: string) => void;
  setVariantQuantity: (variantId: string, quantity: number) => void;
  getSelectedVariants: () => VariantSelection[];
  getTotalQuantity: () => number;
  getOrderItems: () => Array<{ productId: string; size: string; colorName: string; quantity: number }>;
  getSubtotal: () => number;
  getShippingCost: () => number;
  getTotal: () => number;

  // Step 2 actions
  setShippingAddress: (address: Partial<ShippingAddress>) => void;
  setFulfillmentType: (type: FulfillmentType) => void;
  setSelectedVendorCode: (code: string) => void;
  setSelectedPickupId: (id: string) => void;
  setCities: (cities: City[]) => void;
  setCitiesLoading: (loading: boolean) => void;
  setShippingOptions: (options: { delivery: DeliveryOption[]; pickup: PickupLocation[] } | null) => void;
  setShippingLoading: (loading: boolean) => void;
  setCouponCode: (code: string) => void;
  setFieldErrors: (errors: FieldErrors) => void;
  clearFieldError: (field: keyof FieldErrors) => void;

  // Step 3 actions
  setOrder: (order: OrderResponse | null) => void;
  setCreatingOrder: (creating: boolean) => void;

  // Step 4 actions
  setSelectedProviderCode: (code: string) => void;
  setReceiptIdentifier: (id: string) => void;
  setPayerAccount: (account: string) => void;
  setSubmittingReceipt: (submitting: boolean) => void;
  setTxRef: (ref: string) => void;
  setVerifyState: (state: VerificationStatus | null) => void;
  setPollInterval: (interval: number | null) => void;

  // Drafts
  saveDraft: () => void;
  loadDraft: (draftId: string) => void;
  deleteDraft: (draftId: string) => void;

  // Reset
  reset: () => void;
}

const emptyAddress: ShippingAddress = {
  fullName: "",
  phone: "",
  street: "",
  cityId: "",
  cityName: "",
  state: "",
};

const initialState: Omit<
  CheckoutState,
  | "open"
  | "close"
  | "setStep"
  | "goBack"
  | "goForward"
  | "toggleColor"
  | "toggleSize"
  | "setVariantQuantity"
  | "getSelectedVariants"
  | "getTotalQuantity"
  | "getOrderItems"
  | "getSubtotal"
  | "getShippingCost"
  | "getTotal"
  | "setShippingAddress"
  | "setFulfillmentType"
  | "setSelectedVendorCode"
  | "setSelectedPickupId"
  | "setCities"
  | "setCitiesLoading"
  | "setShippingOptions"
  | "setShippingLoading"
  | "setCouponCode"
  | "setFieldErrors"
  | "clearFieldError"
  | "setOrder"
  | "setCreatingOrder"
  | "setSelectedProviderCode"
  | "setReceiptIdentifier"
  | "setPayerAccount"
  | "setSubmittingReceipt"
  | "setTxRef"
  | "setVerifyState"
  | "setPollInterval"
  | "saveDraft"
  | "loadDraft"
  | "deleteDraft"
  | "reset"
> = {
  isOpen: false,
  step: "variants",
  direction: 1,
  productId: "",
  productName: "",
  thumbnailUrl: undefined,
  mockupUrl: undefined,
  basePrice: 0,
  printCost: 0,
  currencySymbol: "Br",
  variants: [],
  artworks: {},
  printAreas: [],
  selectedVariants: new Map(),
  selectedColors: new Set(),
  selectedSizes: new Set(),
  shippingAddress: { ...emptyAddress },
  fulfillmentType: "delivery",
  selectedVendorCode: "",
  selectedPickupId: "",
  cities: [],
  citiesLoading: false,
  shippingOptions: null,
  shippingLoading: false,
  couponCode: "",
  order: null,
  creatingOrder: false,
  selectedProviderCode: "",
  receiptIdentifier: "",
  payerAccount: "",
  submittingReceipt: false,
  txRef: "",
  verifyState: null,
  pollInterval: null,
  fieldErrors: {},
  drafts: [],
};

const stepOrder: CheckoutStep[] = ["variants", "shipping", "review", "payment"];

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set, get) => ({
      ...initialState,

      open: (config) => {
        const firstVariant = config.variants.find((v) => v.isInStock);
        const initialSelections = new Map<string, VariantSelection>();
        const initialColors = new Set<string>();
        const initialSizes = new Set<string>();

        // Pre-select first variant if available
        if (firstVariant) {
          initialSelections.set(firstVariant.id, {
            variantId: firstVariant.id,
            colorHex: firstVariant.color.hex,
            colorName: firstVariant.color.name,
            size: firstVariant.size,
            quantity: 1,
          });
          initialColors.add(firstVariant.color.hex);
          initialSizes.add(firstVariant.size);
        }

        set({
          isOpen: true,
          step: "variants",
          direction: 1,
          productId: config.productId,
          productName: config.productName,
          thumbnailUrl: config.thumbnailUrl,
          mockupUrl: config.mockupUrl,
          basePrice: config.basePrice,
          printCost: config.printCost ?? 0,
          currencySymbol: config.currencySymbol,
          variants: config.variants,
          artworks: config.artworks,
          printAreas: config.printAreas,
          selectedVariants: initialSelections,
          selectedColors: initialColors,
          selectedSizes: initialSizes,
          shippingAddress: {
            ...emptyAddress,
            fullName: config.userFullName ?? "",
          },
          fulfillmentType: "delivery",
          selectedVendorCode: "",
          selectedPickupId: "",
          cities: [],
          shippingOptions: null,
          couponCode: "",
          order: null,
          creatingOrder: false,
          selectedProviderCode: "",
          receiptIdentifier: "",
          payerAccount: "",
          submittingReceipt: false,
          txRef: "",
          verifyState: null,
          pollInterval: null,
          fieldErrors: {},
        });
      },

      close: () => {
        const state = get();
        if (state.pollInterval) {
          clearInterval(state.pollInterval);
        }
        set({ isOpen: false });
      },

      setStep: (step, direction = 1) => set({ step, direction }),

      goBack: () => {
        const currentIdx = stepOrder.indexOf(get().step);
        if (currentIdx > 0) {
          set({ step: stepOrder[currentIdx - 1], direction: -1 });
        }
      },

      goForward: () => {
        const currentIdx = stepOrder.indexOf(get().step);
        if (currentIdx < stepOrder.length - 1) {
          set({ step: stepOrder[currentIdx + 1], direction: 1 });
        }
      },

      // ─── Multi-Variant Selection (NEW) ─────────────────────────────────────

      toggleColor: (hex) => {
        const state = get();
        const newColors = new Set(state.selectedColors);
        const newSelections = new Map(state.selectedVariants);

        if (newColors.has(hex)) {
          // Remove all variants of this color
          newColors.delete(hex);
          for (const [id, sel] of newSelections) {
            if (sel.colorHex === hex) {
              newSelections.delete(id);
            }
          }
        } else {
          newColors.add(hex);
          // Add first available variant of this color with selected sizes
          const colorVariants = state.variants.filter((v) => v.color.hex === hex && v.isInStock);
          for (const variant of colorVariants) {
            if (state.selectedSizes.has(variant.size) && !newSelections.has(variant.id)) {
              newSelections.set(variant.id, {
                variantId: variant.id,
                colorHex: variant.color.hex,
                colorName: variant.color.name,
                size: variant.size,
                quantity: 1,
              });
            }
          }
        }

        set({ selectedColors: newColors, selectedVariants: newSelections });
      },

      toggleSize: (size) => {
        const state = get();
        const newSizes = new Set(state.selectedSizes);
        const newSelections = new Map(state.selectedVariants);

        if (newSizes.has(size)) {
          newSizes.delete(size);
          // Remove all variants of this size
          for (const [id, sel] of newSelections) {
            if (sel.size === size) {
              newSelections.delete(id);
            }
          }
        } else {
          newSizes.add(size);
          // Add variants for selected colors with this size
          for (const variant of state.variants) {
            if (
              variant.isInStock &&
              state.selectedColors.has(variant.color.hex) &&
              variant.size === size &&
              !newSelections.has(variant.id)
            ) {
              newSelections.set(variant.id, {
                variantId: variant.id,
                colorHex: variant.color.hex,
                colorName: variant.color.name,
                size: variant.size,
                quantity: 1,
              });
            }
          }
        }

        set({ selectedSizes: newSizes, selectedVariants: newSelections });
      },

      setVariantQuantity: (variantId, quantity) => {
        const state = get();
        const newSelections = new Map(state.selectedVariants);

        if (quantity <= 0) {
          newSelections.delete(variantId);
          // Clean up colors/sizes if no variants remain
          const remainingColors = new Set<string>();
          const remainingSizes = new Set<string>();
          for (const sel of newSelections.values()) {
            remainingColors.add(sel.colorHex);
            remainingSizes.add(sel.size);
          }
          set({
            selectedVariants: newSelections,
            selectedColors: remainingColors,
            selectedSizes: remainingSizes,
          });
          return;
        }

        const variant = state.variants.find((v) => v.id === variantId);
        if (!variant) return;

        newSelections.set(variantId, {
          variantId,
          colorHex: variant.color.hex,
          colorName: variant.color.name,
          size: variant.size,
          quantity: Math.min(quantity, variant.stockQuantity),
        });

        set({ selectedVariants: newSelections });
      },

      getSelectedVariants: () => {
        return Array.from(get().selectedVariants.values());
      },

      getTotalQuantity: () => {
        let total = 0;
        get().selectedVariants.forEach((sel) => { total += sel.quantity; });
        return total;
      },

      getOrderItems: () => {
        const state = get();
        const items: Array<{ productId: string; size: string; colorName: string; quantity: number }> = [];

        for (const sel of state.selectedVariants.values()) {
          items.push({
            productId: state.productId,
            size: sel.size,
            colorName: sel.colorName,
            quantity: sel.quantity,
          });
        }

        return items;
      },

      getSubtotal: () => {
        const state = get();
        const qty = state.getTotalQuantity();
        return (state.basePrice + state.printCost) * qty;
      },

      getShippingCost: () => {
        const state = get();
        if (state.fulfillmentType !== "delivery" || !state.shippingOptions) return 0;
        const opt = state.shippingOptions.delivery.find((d) => d.vendorCode === state.selectedVendorCode);
        return opt && !opt.isFree ? parseFloat(opt.cost) : 0;
      },

      getTotal: () => {
        const state = get();
        return state.getSubtotal() + state.getShippingCost();
      },

      // Step 2
      setShippingAddress: (address) =>
        set((state) => ({
          shippingAddress: { ...state.shippingAddress, ...address },
        })),

      setFulfillmentType: (type) =>
        set({
          fulfillmentType: type,
          selectedVendorCode: type === "delivery" ? get().selectedVendorCode : "",
          selectedPickupId: type === "pickup" ? get().selectedPickupId : "",
        }),

      setSelectedVendorCode: (code) => set({ selectedVendorCode: code }),

      setSelectedPickupId: (id) => set({ selectedPickupId: id }),

      setCities: (cities) => set({ cities }),

      setCitiesLoading: (loading) => set({ citiesLoading: loading }),

      setShippingOptions: (options) => set({ shippingOptions: options }),

      setShippingLoading: (loading) => set({ shippingLoading: loading }),

      setCouponCode: (code) => set({ couponCode: code }),

      setFieldErrors: (errors) => set({ fieldErrors: errors }),

      clearFieldError: (field) =>
        set((state) => ({
          fieldErrors: { ...state.fieldErrors, [field]: undefined },
        })),

      // Step 3
      setOrder: (order) => set({ order }),

      setCreatingOrder: (creating) => set({ creatingOrder: creating }),

      // Step 4
      setSelectedProviderCode: (code) => set({ selectedProviderCode: code }),

      setReceiptIdentifier: (id) => set({ receiptIdentifier: id }),

      setPayerAccount: (account) => set({ payerAccount: account }),

      setSubmittingReceipt: (submitting) => set({ submittingReceipt: submitting }),

      setTxRef: (ref) => set({ txRef: ref }),

      setVerifyState: (state) => set({ verifyState: state }),

      setPollInterval: (interval) => set({ pollInterval: interval }),

      // Drafts
      saveDraft: () => {
        const state = get();
        const draft: CheckoutDraft = {
          id: `draft_${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          productId: state.productId,
          productName: state.productName,
          thumbnailUrl: state.thumbnailUrl,
          mockupUrl: state.mockupUrl,
          variants: state.variants,
          artworks: state.artworks,
          printAreas: state.printAreas,
          step: state.step,
          shipping: {
            address: state.shippingAddress,
            fulfillmentType: state.fulfillmentType,
            selectedVendorCode: state.selectedVendorCode,
            selectedPickupId: state.selectedPickupId,
          },
          pricing: {
            basePrice: state.basePrice,
            printCost: state.printCost,
            markupAmount: 0,
            shippingCost: state.getShippingCost(),
            total: state.getTotal(),
            currencySymbol: state.currencySymbol,
          },
        };
        set((s) => ({ drafts: [draft, ...s.drafts].slice(0, 10) }));
      },

      loadDraft: (draftId) => {
        const draft = get().drafts.find((d) => d.id === draftId);
        if (!draft) return;
        set({
          productId: draft.productId,
          productName: draft.productName,
          thumbnailUrl: draft.thumbnailUrl,
          mockupUrl: draft.mockupUrl,
          variants: draft.variants,
          artworks: draft.artworks,
          printAreas: draft.printAreas,
          step: draft.step,
          shippingAddress: draft.shipping?.address ?? { ...emptyAddress },
          fulfillmentType: draft.shipping?.fulfillmentType ?? "delivery",
          selectedVendorCode: draft.shipping?.selectedVendorCode ?? "",
          selectedPickupId: draft.shipping?.selectedPickupId ?? "",
          isOpen: true,
        });
      },

      deleteDraft: (draftId) =>
        set((state) => ({
          drafts: state.drafts.filter((d) => d.id !== draftId),
        })),

      reset: () => {
        const state = get();
        if (state.pollInterval) {
          clearInterval(state.pollInterval);
        }
        set({ ...initialState, drafts: state.drafts });
      },
    }),
    {
      name: "checkout-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ drafts: state.drafts }),
    },
  ),
);