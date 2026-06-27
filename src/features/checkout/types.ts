// src/features/checkout/types.ts — v2
// Added isVerified, isTerminal, errorMessage, verifiedAt to ReceiptSubmission
// so StepPayment can act on terminal results without a second type cast.

import type { ArtworkState, PrintArea } from "@/features/studio/store";

export type CheckoutStep = "variants" | "shipping" | "review" | "payment";

export interface CheckoutVariant {
  id: string; sku: string;
  color: { name: string; hex: string };
  size: string; stockQuantity: number; isInStock: boolean;
  additionalPrice: string; quantity: number;
}

export interface CheckoutItem {
  productId: string; variantId: string;
  size: string; colorName: string; colorHex: string;
  quantity: number; unitPrice: number;
  printAreas: Array<{ areaId: string; areaName: string; artwork: ArtworkState }>;
}

export interface ShippingAddress {
  fullName: string; phone: string; street: string;
  cityId: string; cityName: string; state: string;
  postalCode?: string; deliveryInstructions?: string;
}

export interface City { id: string; name: string; state: string; }

export interface DeliveryOption {
  vendorCode: string; vendorName: string; serviceName: string;
  serviceLevel: "standard" | "express"; cost: string; currency: string;
  estimatedDays: string; isFree: boolean;
}

export interface PickupLocation {
  locationId: string; name: string; address: string;
  landmark?: string; phone?: string; instructions?: string;
  estimatedDays: string; isFree: boolean;
}

export interface ShippingOptions {
  delivery: DeliveryOption[];
  pickup: PickupLocation[];
}

export type FulfillmentType = "delivery" | "pickup";

export interface PaymentMethod {
  providerCode: string; providerName: string; providerLogo?: string;
  accountName: string; accountNumber: string; accountType: string;
  referenceLabel: string; referencePlaceholder: string; referenceHelpText: string;
  requiresPayerAccount: boolean; payerAccountLabel?: string;
}

export interface InvoiceData {
  number: string; orderNumber: string; orderId: string;
  createdAt: string; expiresAt: string; expiresInSeconds: number; status: string;
  store: { name: string; logoUrl?: string };
  amount: {
    subtotal: string; shipping: string; tax: string; discount: string;
    total: string; currency: { code: string; symbol: string };
  };
  items: Array<{
    productName: string; size: string; color: string; quantity: number;
    unitPrice: string; subtotal: string; mockupUrl?: string;
  }>;
  payment: {
    instructions: string; warning?: string; note?: string;
    methods: PaymentMethod[];
  };
}

export interface OrderResponse {
  id: string; orderNumber: string; status: string; paymentStatus: string;
  deliveryType: FulfillmentType;
  invoice: InvoiceData;
  pricing: {
    subtotal: string; shippingCost: string; discount: string;
    total: string; currency: { code: string; symbol: string };
  };
  shipping: {
    deliveryType: FulfillmentType; vendor?: string; serviceLevel?: string;
    address?: ShippingAddress; pickupLocation?: PickupLocation;
  };
  trackingNumber?: string; trackingUrl?: string; canCancel: boolean;
  timeline: { created: string; paid?: string; shipped?: string; delivered?: string };
}

/**
 * Extended receipt submission result.
 * Backend verifies synchronously so the submit response can already be terminal.
 * isTerminal = true → show result immediately, do NOT start polling.
 * isTerminal = false → backend still processing, start polling /payment/verify/.
 */
export interface ReceiptSubmission {
  transactionId: string;
  status: string;
  statusDisplay: string;
  message: string;
  amount: string;
  currency: string;
  provider: string;
  submittedAt: string;
  // Fields added in v2 — always present in real API responses
  isVerified:  boolean;
  isTerminal:  boolean;
  errorMessage?: string;
  verifiedAt?:  string;
  orderStatus?: string;
  orderPaymentStatus?: string;
}

export interface VerificationStatus {
  transactionId: string;
  status: "submitted" | "verifying" | "verified" | "mismatch" | "failed";
  statusDisplay: string;
  isVerified: boolean;
  isTerminal: boolean;
  amount: string; currency: string; provider: string;
  receiptIdentifier: string;
  errorMessage?: string;
  submittedAt: string;
  verifiedAt?: string;
}

export interface CheckoutDraft {
  id: string; createdAt: string; updatedAt: string;
  productId: string; productName: string; thumbnailUrl?: string; mockupUrl?: string;
  variants: CheckoutVariant[];
  artworks: Record<string, ArtworkState>;
  printAreas: PrintArea[];
  step: CheckoutStep;
  shipping?: {
    address?: ShippingAddress; fulfillmentType: FulfillmentType;
    selectedVendorCode?: string; selectedPickupId?: string;
  };
  pricing: {
    basePrice: number; printCost: number; markupAmount: number;
    shippingCost: number; total: number; currencySymbol: string;
  };
}

export interface FieldErrors {
  fullName?: string; phone?: string; street?: string; city?: string;
  vendor?: string; pickupLocation?: string; coupon?: string;
  receipt?: string; payerAccount?: string;
}

export interface VariantSelection {
  variantId: string; colorHex: string; colorName: string;
  size: string; quantity: number;
}