// src/features/checkout/api.ts

import { api } from "@/shared/api/client";
import type {
  City,
  DeliveryOption,
  FulfillmentType,
  InvoiceData,
  OrderResponse,
  PaymentMethod,
  PickupLocation,
  ReceiptSubmission,
  ShippingAddress,
  ShippingOptions,
  VerificationStatus,
} from "./types";

/* ─── Shipping ───────────────────────────────────────────────────────────── */

interface ShippingCitiesResponse {
  success: boolean;
  data: Array<{
    id: string;
    name: string;
    state: string;
  }>;
}

interface ShippingOptionsApiResponse {
  success: boolean;
  data: {
    delivery: Array<{
      vendor_code: string;
      vendor_name: string;
      service_name: string;
      service_level: "standard" | "express";
      cost: string;
      currency: string;
      estimated_days: string;
      is_free: boolean;
    }>;
    pickup: Array<{
      location_id: string;
      name: string;
      address: string;
      landmark?: string;
      phone?: string;
      instructions?: string;
      estimated_days: string;
      is_free: boolean;
    }>;
  };
}

export const checkoutApi = {
  /** GET /api/v1/shipping/cities/ */
  getCities: async (): Promise<City[]> => {
    const res = await api.get<ShippingCitiesResponse>("/shipping/cities/");
    return res.data.map((c) => ({ id: c.id, name: c.name, state: c.state }));
  },

  /** GET /api/v1/shipping/options/?city_id={cityId}&item_count={count}&subtotal={subtotal} */
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
        vendorCode: d.vendor_code,
        vendorName: d.vendor_name,
        serviceName: d.service_name,
        serviceLevel: d.service_level,
        cost: d.cost,
        currency: d.currency,
        estimatedDays: d.estimated_days,
        isFree: d.is_free,
      })),
      pickup: res.data.pickup.map((p) => ({
        locationId: p.location_id,
        name: p.name,
        address: p.address,
        landmark: p.landmark,
        phone: p.phone,
        instructions: p.instructions,
        estimatedDays: p.estimated_days,
        isFree: p.is_free,
      })),
    };
  },
};

/* ─── Orders ─────────────────────────────────────────────────────────────── */

interface CreateOrderPayload {
  items: Array<{
    product_id: string;
    size: string;
    color_name: string;
    quantity: number;
  }>;
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
    id: string;
    order_number: string;
    status: string;
    payment_status: string;
    delivery_type: FulfillmentType;
    invoice: {
      number: string;
      order_number: string;
      order_id: string;
      created_at: string;
      expires_at: string;
      expires_in_seconds: number;
      status: string;
      store: { name: string; logo_url?: string };
      amount: {
        subtotal: string;
        shipping: string;
        tax: string;
        discount: string;
        total: string;
        currency: { code: string; symbol: string };
      };
      items: Array<{
        product_name: string;
        size: string;
        color: string;
        quantity: number;
        unit_price: string;
        subtotal: string;
        mockup_url?: string;
      }>;
      payment: {
        instructions: string;
        warning?: string;
        note?: string;
        methods: Array<{
          provider_code: string;
          provider_name: string;
          provider_logo?: string;
          account_name: string;
          account_number: string;
          account_type: string;
          reference: {
            label: string;
            placeholder: string;
            help_text: string;
          };
          requires_payer_account: boolean;
          payer_account_label?: string;
        }>;
      };
    };
    pricing: {
      subtotal: string;
      shipping_cost: string;
      discount: string;
      total: string;
      currency: { code: string; symbol: string };
    };
    shipping: {
      delivery_type: FulfillmentType;
      vendor?: string;
      service_level?: string;
      address?: ShippingAddress;
      pickup_location?: PickupLocation;
    };
    tracking_number?: string;
    tracking_url?: string;
    can_cancel: boolean;
    timeline: {
      created: string;
      paid?: string;
      shipped?: string;
      delivered?: string;
    };
  };
}

function mapOrderResponse(raw: CreateOrderApiResponse["data"]): OrderResponse {
  return {
    id: raw.id,
    orderNumber: raw.order_number,
    status: raw.status,
    paymentStatus: raw.payment_status,
    deliveryType: raw.delivery_type,
    invoice: {
      number: raw.invoice.number,
      orderNumber: raw.invoice.order_number,
      orderId: raw.invoice.order_id,
      createdAt: raw.invoice.created_at,
      expiresAt: raw.invoice.expires_at,
      expiresInSeconds: raw.invoice.expires_in_seconds,
      status: raw.invoice.status,
      store: raw.invoice.store,
      amount: raw.invoice.amount,
      items: raw.invoice.items,
      payment: raw.invoice.payment,
    },
    pricing: {
      subtotal: raw.pricing.subtotal,
      shippingCost: raw.pricing.shipping_cost,
      discount: raw.pricing.discount,
      total: raw.pricing.total,
      currency: raw.pricing.currency,
    },
    shipping: raw.shipping,
    trackingNumber: raw.tracking_number,
    trackingUrl: raw.tracking_url,
    canCancel: raw.can_cancel,
    timeline: raw.timeline,
  };
}

export const orderApi = {
  /** POST /api/v1/orders/ */
  create: async (payload: CreateOrderPayload): Promise<OrderResponse> => {
    const res = await api.post<CreateOrderApiResponse>("/orders/", { body: payload });
    return mapOrderResponse(res.data);
  },

  /** POST /api/v1/orders/{id}/cancel/ */
  cancel: async (orderId: string, reason: string): Promise<void> => {
    await api.post(`/orders/${orderId}/cancel/`, { body: { reason } });
  },
};

/* ─── Payment ────────────────────────────────────────────────────────────── */

interface SubmitReceiptPayload {
  order_id: string;
  provider: string;
  receipt_identifier: string;
  payer_account?: string;
}

interface SubmitReceiptApiResponse {
  success: boolean;
  data: {
    transaction_id: string;
    status: string;
    status_display: string;
    message: string;
    amount: string;
    currency: string;
    provider: string;
    submitted_at: string;
  };
}

interface VerifyApiResponse {
  success: boolean;
  data: {
    transaction_id: string;
    status: "submitted" | "verifying" | "verified" | "mismatch" | "failed";
    status_display: string;
    is_verified: boolean;
    is_terminal?: boolean;
    amount: string;
    currency: string;
    provider: string;
    receipt_identifier: string;
    error_message?: string;
    submitted_at: string;
    verified_at?: string;
  };
}

export const paymentApi = {
  /** POST /api/v1/payment/submit-receipt/ */
  submitReceipt: async (payload: SubmitReceiptPayload): Promise<ReceiptSubmission> => {
    const res = await api.post<SubmitReceiptApiResponse>("/payment/submit-receipt/", {
      body: payload,
    });
    return {
      transactionId: res.data.transaction_id,
      status: res.data.status,
      statusDisplay: res.data.status_display,
      message: res.data.message,
      amount: res.data.amount,
      currency: res.data.currency,
      provider: res.data.provider,
      submittedAt: res.data.submitted_at,
    };
  },

  /** POST /api/v1/payment/verify/ */
  verify: async (txRef: string): Promise<VerificationStatus> => {
    const res = await api.post<VerifyApiResponse>("/payment/verify/", {
      body: { tx_ref: txRef },
    });
    return {
      transactionId: res.data.transaction_id,
      status: res.data.status,
      statusDisplay: res.data.status_display,
      isVerified: res.data.is_verified,
      isTerminal: res.data.is_terminal ?? false,
      amount: res.data.amount,
      currency: res.data.currency,
      provider: res.data.provider,
      receiptIdentifier: res.data.receipt_identifier,
      errorMessage: res.data.error_message,
      submittedAt: res.data.submitted_at,
      verifiedAt: res.data.verified_at,
    };
  },
};