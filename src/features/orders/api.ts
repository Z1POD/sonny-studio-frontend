/**
 * src/features/orders/api.ts
 *
 * All order & payment API calls, typed against the API contract.
 */

import { api } from "@/shared/api/client";

//     Shared shapes                                                             

export interface OrderCurrency {
  code: string;
  symbol: string;
}

export interface OrderAmounts {
  subtotal: string;
  shipping: string;
  tax: string;
  discount: string;
  total: string;
  currency: OrderCurrency;
}

export interface OrderItem {
  id: string;
  product_name: string;
  size: string;
  color_name: string;
  color_hex: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
  mockup_url: string;
}

export interface OrderDiscount {
  type?: string;
  description: string;
  amount: string;
  is_automatic: boolean;
}

export interface PaymentMethod {
  provider_code: string;
  provider_name: string;
  provider_logo: string;
  account_name: string;
  account_number: string;
  account_type: string;
  reference: {
    label: string;
    placeholder: string;
    help_text: string;
  };
  requires_payer_account: boolean;
  payer_account_label: string | null;
}

export interface OrderInvoice {
  number: string;
  order_number: string;
  order_id: string;
  created_at: string;
  expires_at: string;
  expires_in_seconds: number;
  status: string;
  store: { name: string; logo_url: string };
  amount: OrderAmounts;
  items: Array<{
    product_name: string;
    size: string;
    color: string;
    quantity: number;
    unit_price: string;
    subtotal: string;
    mockup_url: string;
  }>;
  discounts: OrderDiscount[];
  payment: {
    instructions: string;
    warning: string;
    note: string;
    methods: PaymentMethod[];
  };
  verification: {
    action: string;
    endpoint: string;
    method: string;
    body: Record<string, string>;
  };
}

export interface OrderShipping {
  delivery_type: "delivery" | "pickup";
  vendor?: string;
  service_level?: string;
  address?: {
    full_name: string;
    phone: string;
    street: string;
    city_name: string;
    country_name: string;
  };
  pickup_location?: {
    name: string;
    address: string;
    landmark: string;
    phone: string;
    instructions: string;
  };
}

export interface OrderTimeline {
  created: string;
  paid: string | null;
  shipped: string | null;
  delivered: string | null;
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "printing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentStatus =
  | "pending"
  | "pending_verification"
  | "paid"
  | "failed";

//     List item                                                                 

export interface OrderListItem {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  delivery_type: "delivery" | "pickup";
  total: string;
  currency_code: string;
  currency_symbol: string;
  item_count: number;
  first_item: {
    product_name: string;
    size: string;
    color: string;
    color_hex: string;
    quantity: number;
    mockup_url: string;
  };
  payment_provider_name: string | null;
  created_at: string;
}

export interface OrderListResponse {
  success: true;
  data: OrderListItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

//     Full detail                                                               

export interface OrderDetail {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  delivery_type: "delivery" | "pickup";
  invoice: OrderInvoice;
  pricing: {
    subtotal: string;
    shipping_cost: string;
    discount: string;
    total: string;
    currency: OrderCurrency;
  };
  shipping: OrderShipping;
  payment: {
    status: PaymentStatus;
    provider: string | null;
    receipt_id: string;
    verified_at: string | null;
  };
  items: OrderItem[];
  item_count: number;
  discounts: OrderDiscount[];
  tracking_number: string;
  tracking_url: string;
  customer_note: string;
  cancellation_reason: string;
  can_cancel: boolean;
  timeline: OrderTimeline;
  created_at: string;
  updated_at?: string;
}

interface DetailApiResponse {
  success: boolean;
  data: OrderDetail;
}

//     Payment                                                                   

export interface SubmitReceiptPayload {
  order_id: string;
  provider: string;
  receipt_identifier: string;
  payer_account?: string;
}

export interface SubmitReceiptResponse {
  transaction_id: string;
  status: "submitted";
  status_display: string;
  message: string;
  amount: string;
  currency: string;
  provider: string;
  submitted_at: string;
}

export interface VerifyPaymentResponse {
  transaction_id: string;
  status: "submitted" | "verifying" | "verified" | "mismatch" | "failed";
  status_display: string;
  is_verified: boolean;
  amount: string;
  currency: string;
  provider: string;
  receipt_identifier: string;
  error_message: string;
  submitted_at: string;
  verified_at: string | null;
}

export interface PaymentProvider {
  id: string;
  name: string;
  code: string;
  provider_type: string;
  logo_url: string;
  receipt_label: string;
  receipt_placeholder: string;
  receipt_help_text: string;
  requires_account_number: boolean;
  accounts: Array<{
    account_name: string;
    account_number: string;
    account_type: string;
  }>;
}

//     API object                                                                

export const ordersApi = {
  list: async (params?: {
    page?: number;
    page_size?: number;
    status?: string;
    payment_status?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<OrderListResponse> => {
    return api.get<OrderListResponse>("/orders/", {
      params: {
        page: params?.page ?? 1,
        page_size: params?.page_size ?? 20,
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.payment_status ? { payment_status: params.payment_status } : {}),
        ...(params?.start_date ? { start_date: params.start_date } : {}),
        ...(params?.end_date ? { end_date: params.end_date } : {}),
      },
    });
  },

  detail: async (id: string): Promise<OrderDetail> => {
    const res = await api.get<DetailApiResponse>(`/orders/${id}/`);
    return res.data;
  },

  cancel: async (id: string, reason: string): Promise<OrderDetail> => {
    const res = await api.post<DetailApiResponse>(`/orders/${id}/cancel/`, {
      body: { reason },
    });
    return res.data;
  },

  invoice: async (id: string): Promise<{ invoice_url: string; invoice_number: string }> => {
    const res = await api.get<{ success: boolean; data: { invoice_url: string; invoice_number: string } }>(
      `/orders/${id}/invoice/`,
    );
    return res.data;
  },

  /**
   * @deprecated Predates the backend's `is_terminal` field, so it always
   * assumes polling is needed. OrderDetailSheet now goes through
   * `usePaymentVerification` (src/features/payment/hooks), which calls the
   * canonical `paymentApi` from src/features/payment/api.ts instead. Kept
   * here only in case other code still references it directly.
   */
  submitReceipt: async (
    payload: SubmitReceiptPayload,
  ): Promise<SubmitReceiptResponse> => {
    const res = await api.post<{ success: boolean; data: SubmitReceiptResponse }>(
      "/payment/submit-receipt/",
      { body: payload },
    );
    return res.data;
  },

  /** @deprecated see submitReceipt above — prefer `paymentApi.verify` from src/features/payment/api.ts. */
  verifyPayment: async (txRef: string): Promise<VerifyPaymentResponse> => {
    const res = await api.post<{ success: boolean; data: VerifyPaymentResponse }>(
      "/payment/verify/",
      { body: { tx_ref: txRef } },
    );
    return res.data;
  },

  getProviders: async (): Promise<PaymentProvider[]> => {
    const res = await api.get<{ success: boolean; data: PaymentProvider[] }>(
      "/payment/providers/",
    );
    return res.data;
  },
};