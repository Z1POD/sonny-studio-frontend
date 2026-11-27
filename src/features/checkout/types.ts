// src/features/checkout/types.ts

/** Minimal print-area / artwork info checkout needs for its review summary (no 3D data). */
export interface CheckoutPrintArea {
  id: string;
  name: string;
}
export interface CheckoutArtwork {
  /** Preview image of what is printed in the area (an artwork URL, or the design mockup). */
  decalUrl: string;
}

//     Checkout Step State                                                     

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
  designId: string;
  /** Contract `variant_id` (whitelisted combination). */
  variantId: string;
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
  /** Contract `design_id`: the published design, or the design saved from the studio. */
  designId: string;
  variantId: string;
  size: string;
  colorName: string;
  colorHex: string;
  quantity: number;
  unitPrice: number;
  printAreas: Array<{
    areaId: string;
    areaName: string;
    artwork: CheckoutArtwork;
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
  countryCode?: string;
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
  /** The city's `kind: "pickup"` delivery option, required by checkout together with the location. */
  deliveryOptionId: string;
  cost?: string;
  currency?: string;
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

/** The slice of an order checkout needs after `POST /orders/`. */
export interface OrderResponse {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  currency: { code: string; symbol: string; decimal_places?: number };
}

/** Server-computed totals from `POST /orders/checkout/validate/` (never computed client-side). */
export interface CheckoutQuote {
  currency: { code: string; symbol: string; decimal_places: number };
  subtotal: string;
  shipping: string;
  tax: string;
  discount: string;
  total: string;
  lines: Array<{ designId: string; variantId: string; quantity: number; unitPrice: string; lineTotal: string }>;
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

//     Checkout Draft                                                          

export interface CheckoutDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
  productId: string;
  productName: string;
  thumbnailUrl?: string;
  mockupUrl?: string;
  variants: CheckoutVariant[];
  artworks: Record<string, CheckoutArtwork>;
  printAreas: CheckoutPrintArea[];
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

//     Form Validation                                                       

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

//     Multi-Variant Selection                                               

export interface VariantSelection {
  variantId: string;
  colorHex: string;
  colorName: string;
  size: string;
  quantity: number;
}