// src/features/checkout/api.ts — v2

import { api, ApiError } from "@/shared/api/client";
import type {
  City,
  FieldErrors,
  FulfillmentType,
  OrderResponse,
  PickupLocation,
  ReceiptSubmission,
  ShippingAddress,
  ShippingOptions,
  VerificationStatus,
} from "./types";

/*     Backend field-error mapping                                            */

// M I M O API validation envelope:
//   { success: false, error: { code, message, details: { field: ["msg", ...] } } }
// `details` keys are backend/snake_case field names — map them onto the
// FieldErrors keys the checkout UI actually renders against (fieldErrors.coupon,
// fieldErrors.phone, etc.) so any step can surface the right inline error.
const BACKEND_FIELD_MAP: Record<string, keyof FieldErrors> = {
  coupon_code: "coupon",
  full_name: "fullName",
  phone: "phone",
  street: "street",
  city_id: "city",
  shipping_vendor: "vendor",
  shipping_service_level: "vendor",
  pickup_location_id: "pickupLocation",
  receipt_identifier: "receipt",
  payer_account: "payerAccount",
};

/**
 * Extracts field-level validation errors from an ApiError thrown by the
 * shared api client, mapped onto the checkout FieldErrors shape. Returns an
 * empty object for non-validation errors (network failures, 5xx, etc.) or
 * when the response has no `error.details`.
 */
export function getFieldErrorsFromApiError(error: unknown): FieldErrors {
  if (!(error instanceof ApiError)) return {};

  const details = (error.data as {
    error?: { details?: Record<string, string[]> };
  } | null)?.error?.details;

  if (!details) return {};

  const out: FieldErrors = {};
  for (const [backendKey, messages] of Object.entries(details)) {
    const mapped = BACKEND_FIELD_MAP[backendKey];
    if (mapped && Array.isArray(messages) && messages.length > 0 && !out[mapped]) {
      out[mapped] = messages[0];
    }
  }
  return out;
}

/*     Shipping                                                               */

interface ShippingCitiesResponse {
  success: boolean;
  data: Array<{ id: string; name: string; state: string }>;
}

interface ShippingOptionsApiResponse {
  success: boolean;
  data: {
    delivery: Array<{
      vendor_code: string; vendor_name: string; service_name: string;
      service_level: "standard" | "express"; cost: string; currency: string;
      estimated_days: string; is_free: boolean;
    }>;
    pickup: Array<{
      location_id: string; name: string; address: string;
      landmark?: string; phone?: string; instructions?: string;
      estimated_days: string; is_free: boolean;
    }>;
  };
}

export const checkoutApi = {
  getCities: async (): Promise<City[]> => {
    const res = await api.get<ShippingCitiesResponse>("/shipping/cities/");
    return res.data.map((c) => ({ id: c.id, name: c.name, state: c.state }));
  },

  getShippingOptions: async (
    cityId: string,
    itemCount: number,
    subtotal: number,
  ): Promise<ShippingOptions> => {
    const res = await api.get<ShippingOptionsApiResponse>("/shipping/options/", {
      params: { city_id: cityId, item_count: itemCount, subtotal: subtotal.toString() },
    });
    return {
      delivery: res.data.delivery.map((d) => ({
        vendorCode: d.vendor_code, vendorName: d.vendor_name,
        serviceName: d.service_name, serviceLevel: d.service_level,
        cost: d.cost, currency: d.currency,
        estimatedDays: d.estimated_days, isFree: d.is_free,
      })),
      pickup: res.data.pickup.map((p) => ({
        locationId: p.location_id, name: p.name, address: p.address,
        landmark: p.landmark, phone: p.phone, instructions: p.instructions,
        estimatedDays: p.estimated_days, isFree: p.is_free,
      })),
    };
  },
};

/*     Orders                                                                 */

interface CreateOrderPayload {
  items: Array<{ product_id: string; size: string; color_name: string; quantity: number }>;
  delivery_type: FulfillmentType;
  shipping_address?: ShippingAddress;
  shipping_vendor?: string;
  shipping_service_level?: string;
  pickup_location_id?: string;
  coupon_code?: string;
  customer_note?: string;
  currency: string;
}

interface CreateOrderApiResponse {
  success: boolean;
  data: {
    id: string; order_number: string; status: string; payment_status: string;
    delivery_type: FulfillmentType;
    invoice: {
      number: string; order_number: string; order_id: string;
      created_at: string; expires_at: string; expires_in_seconds: number;
      status: string;
      store: { name: string; logo_url?: string };
      amount: {
        subtotal: string; shipping: string; tax: string; discount: string;
        total: string; currency: { code: string; symbol: string };
      };
      items: Array<{
        product_name: string; size: string; color: string; quantity: number;
        unit_price: string; subtotal: string; mockup_url?: string;
      }>;
      payment: {
        instructions: string; warning?: string; note?: string;
        methods: Array<{
          provider_code: string; provider_name: string; provider_logo?: string;
          account_name: string; account_number: string; account_type: string;
          reference: { label: string; placeholder: string; help_text: string };
          requires_payer_account: boolean; payer_account_label?: string;
        }>;
      };
    };
    pricing: {
      subtotal: string; shipping_cost: string; discount: string;
      total: string; currency: { code: string; symbol: string };
    };
    shipping: {
      delivery_type: FulfillmentType; vendor?: string; service_level?: string;
      address?: ShippingAddress; pickup_location?: PickupLocation;
    };
    tracking_number?: string; tracking_url?: string; can_cancel: boolean;
    timeline: { created: string; paid?: string; shipped?: string; delivered?: string };
  };
}

function mapOrderResponse(raw: CreateOrderApiResponse["data"]): OrderResponse {
  return {
    id:            raw.id,
    orderNumber:   raw.order_number,
    status:        raw.status,
    paymentStatus: raw.payment_status,
    deliveryType:  raw.delivery_type,
    invoice: {
      number:          raw.invoice.number,
      orderNumber:     raw.invoice.order_number,
      orderId:         raw.invoice.order_id,
      createdAt:       raw.invoice.created_at,
      expiresAt:       raw.invoice.expires_at,
      expiresInSeconds: raw.invoice.expires_in_seconds,
      status:          raw.invoice.status,
      store:           raw.invoice.store,
      amount:          raw.invoice.amount,
      items:           raw.invoice.items,
      payment:         raw.invoice.payment,
    },
    pricing: {
      subtotal:     raw.pricing.subtotal,
      shippingCost: raw.pricing.shipping_cost,
      discount:     raw.pricing.discount,
      total:        raw.pricing.total,
      currency:     raw.pricing.currency,
    },
    shipping:       raw.shipping,
    trackingNumber: raw.tracking_number,
    trackingUrl:    raw.tracking_url,
    canCancel:      raw.can_cancel,
    timeline:       raw.timeline,
  };
}

export const orderApi = {
  create: async (payload: CreateOrderPayload): Promise<OrderResponse> => {
    const res = await api.post<CreateOrderApiResponse>("/orders/", { body: payload });
    return mapOrderResponse(res.data);
  },
  cancel: async (orderId: string, reason: string): Promise<void> => {
    await api.post(`/orders/${orderId}/cancel/`, { body: { reason } });
  },
};

/*     Payment                                                                */

interface SubmitReceiptPayload {
  order_id: string;
  provider: string;
  receipt_identifier: string;
  payer_account?: string;
}

//    Full response from POST /payment/submit-receipt/                          
// Backend verifies synchronously and returns the ACTUAL result straight away.
// is_terminal = true  → show result immediately, skip polling
// is_terminal = false → still processing, start polling
interface SubmitReceiptApiResponse {
  success: boolean;
  data: {
    transaction_id: string;
    status: string;
    status_display: string;
    is_verified: boolean;
    is_terminal: boolean;       // ← KEY: skip polling when true
    message: string;
    error_message: string | null;
    amount: string;
    currency: string;
    provider: string;
    submitted_at: string;
    verified_at: string | null;
    order_status: string;
    order_payment_status: string;
  };
}

// Extended ReceiptSubmission carries all terminal-decision fields
export interface ReceiptSubmissionFull extends ReceiptSubmission {
  isVerified:  boolean;
  isTerminal:  boolean;
  errorMessage?: string;
  verifiedAt?:  string;
  orderStatus?: string;
  orderPaymentStatus?: string;
}

interface VerifyApiResponse {
  success: boolean;
  data: {
    transaction_id: string;
    status: "submitted" | "verifying" | "verified" | "mismatch" | "failed";
    status_display: string;
    is_verified: boolean;
    is_terminal: boolean;
    amount: string; currency: string; provider: string;
    receipt_identifier: string;
    error_message?: string;
    submitted_at: string;
    verified_at?: string;
    order_status?: string;
    order_payment_status?: string;
  };
}

export const paymentApi = {
  /**
   * POST /api/v1/payment/submit-receipt/
   *
   * Backend verifies synchronously. The response includes is_terminal so
   * the frontend can skip polling entirely when it's already resolved.
   */
  submitReceipt: async (payload: SubmitReceiptPayload): Promise<ReceiptSubmissionFull> => {
    const res = await api.post<SubmitReceiptApiResponse>("/payment/submit-receipt/", {
      body: payload,
    });
    const d = res.data;
    return {
      // Base ReceiptSubmission fields
      transactionId: d.transaction_id,
      status:        d.status,
      statusDisplay: d.status_display,
      message:       d.message,
      amount:        d.amount,
      currency:      d.currency,
      provider:      d.provider,
      submittedAt:   d.submitted_at,
      // Extended fields for immediate terminal decision
      isVerified:    d.is_verified,
      isTerminal:    d.is_terminal,
      errorMessage:  d.error_message ?? undefined,
      verifiedAt:    d.verified_at   ?? undefined,
      orderStatus:   d.order_status,
      orderPaymentStatus: d.order_payment_status,
    };
  },

  /**
   * POST /api/v1/payment/verify/
   * Polling endpoint — only called when submit returned is_terminal = false.
   * Stop polling as soon as response.isTerminal = true.
   */
  verify: async (txRef: string): Promise<VerificationStatus> => {
    const res = await api.post<VerifyApiResponse>("/payment/verify/", {
      body: { tx_ref: txRef },
    });
    const d = res.data;
    return {
      transactionId:     d.transaction_id,
      status:            d.status,
      statusDisplay:     d.status_display,
      isVerified:        d.is_verified,
      isTerminal:        d.is_terminal,
      amount:            d.amount,
      currency:          d.currency,
      provider:          d.provider,
      receiptIdentifier: d.receipt_identifier,
      errorMessage:      d.error_message,
      submittedAt:       d.submitted_at,
      verifiedAt:        d.verified_at,
    };
  },
};