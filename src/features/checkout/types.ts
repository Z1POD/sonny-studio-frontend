// src/features/checkout/types.ts

import type { ArtworkState, PrintArea } from "@/features/studio/store";

// ─── Checkout Step State ────────────────────────────────────────────────────

export type CheckoutStep = "variants" | "shipping" | "review" | "payment";

/**
 * Where this checkout session started from:
 *  - "studio": a single customized product with multiple color/size
 *    variants picked in StepVariantQuantity (existing flow).
 *  - "cart": one or more already-resolved lines (product + color + size +
 *    quantity) coming straight from the marketplace cart — the "variants"
 *    step is skipped entirely; checkout opens directly on "shipping".
 */
export type CheckoutOrigin = "studio" | "cart";

/** A single resolved cart line, enough to build an order item without
 *  going through color/size selection again. */
export interface CartCheckoutLine {
  productId: string;
  title: string;
  thumbnailUrl?: string;
  colorName: string;
  colorHex: string;
  size: string;
  quantity: number;
  unitPrice: number;
  currencySymbol: string;
}

export interface CheckoutVariant {
  id: string;
  sku: string;
  color: { name: string; hex: string };
  size: string;
  stockQuantity: number;
  isInStock: boolean;
  additionalPrice: string;
  quantity: number;
}

export interface CheckoutItem {
  productId: string;
  variantId: string;
  size: string;
  colorName: string;
  colorHex: string;
  quantity: number;
  unitPrice: number;
  printAreas: Array<{
    areaId: string;
    areaName: string;
    artwork: ArtworkState;
  }>;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  street: string;
  cityId: string;
  cityName: string;
  state: string;
  postalCode?: string;
  deliveryInstructions?: string;
}

export interface City {
  id: string;
  name: string;
  state: string;
}

export interface DeliveryOption {
  vendorCode: string;
  vendorName: string;
  serviceName: string;
  serviceLevel: "standard" | "express";
  cost: string;
  currency: string;
  estimatedDays: string;
  isFree: boolean;
}

export interface PickupLocation {
  locationId: string;
  name: string;
  address: string;
  landmark?: string;
  phone?: string;
  instructions?: string;
  estimatedDays: string;
  isFree: boolean;
}

export interface ShippingOptions {
  delivery: DeliveryOption[];
  pickup: PickupLocation[];
}

export type FulfillmentType = "delivery" | "pickup";

export interface PaymentMethod {
  providerCode: string;
  providerName: string;
  providerLogo?: string;
  accountName: string;
  accountNumber: string;
  accountType: string;
  referenceLabel: string;
  referencePlaceholder: string;
  referenceHelpText: string;
  requiresPayerAccount: boolean;
  payerAccountLabel?: string;
}

export interface InvoiceData {
  number: string;
  orderNumber: string;
  orderId: string;
  createdAt: string;
  expiresAt: string;
  expiresInSeconds: number;
  status: string;
  store: { name: string; logoUrl?: string };
  amount: {
    subtotal: string;
    shipping: string;
    tax: string;
    discount: string;
    total: string;
    currency: { code: string; symbol: string };
  };
  items: Array<{
    productName: string;
    size: string;
    color: string;
    quantity: number;
    unitPrice: string;
    subtotal: string;
    mockupUrl?: string;
  }>;
  payment: {
    instructions: string;
    warning?: string;
    note?: string;
    methods: PaymentMethod[];
  };
}

export interface OrderResponse {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  deliveryType: FulfillmentType;
  invoice: InvoiceData;
  pricing: {
    subtotal: string;
    shippingCost: string;
    discount: string;
    total: string;
    currency: { code: string; symbol: string };
  };
  shipping: {
    deliveryType: FulfillmentType;
    vendor?: string;
    serviceLevel?: string;
    address?: ShippingAddress;
    pickupLocation?: PickupLocation;
  };
  trackingNumber?: string;
  trackingUrl?: string;
  canCancel: boolean;
  timeline: {
    created: string;
    paid?: string;
    shipped?: string;
    delivered?: string;
  };
}

export interface ReceiptSubmission {
  transactionId: string;
  status: string;
  statusDisplay: string;
  message: string;
  amount: string;
  currency: string;
  provider: string;
  submittedAt: string;
}

export interface VerificationStatus {
  transactionId: string;
  status: "submitted" | "verifying" | "verified" | "mismatch" | "failed";
  statusDisplay: string;
  isVerified: boolean;
  isTerminal: boolean;
  amount: string;
  currency: string;
  provider: string;
  receiptIdentifier: string;
  errorMessage?: string;
  submittedAt: string;
  verifiedAt?: string;
}

// ─── Checkout Draft ─────────────────────────────────────────────────────────

export interface CheckoutDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
  productId: string;
  productName: string;
  thumbnailUrl?: string;
  mockupUrl?: string;
  variants: CheckoutVariant[];
  artworks: Record<string, ArtworkState>;
  printAreas: PrintArea[];
  step: CheckoutStep;
  shipping?: {
    address?: ShippingAddress;
    fulfillmentType: FulfillmentType;
    selectedVendorCode?: string;
    selectedPickupId?: string;
  };
  pricing: {
    basePrice: number;
    printCost: number;
    markupAmount: number;
    shippingCost: number;
    total: number;
    currencySymbol: string;
  };
}

// ─── Form Validation ──────────────────────────────────────────────────────

export interface FieldErrors {
  fullName?: string;
  phone?: string;
  street?: string;
  city?: string;
  vendor?: string;
  pickupLocation?: string;
  coupon?: string;
  receipt?: string;
  payerAccount?: string;
}

// ─── Multi-Variant Selection ──────────────────────────────────────────────

export interface VariantSelection {
  variantId: string;
  colorHex: string;
  colorName: string;
  size: string;
  quantity: number;
}