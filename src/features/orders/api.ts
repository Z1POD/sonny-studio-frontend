/**
 * src/features/orders/api.ts
 *
 * Orders (`/orders/…`) typed against the Buyer Frontend API contract. Raw responses are mapped to the
 * view models the orders UI renders (snake_case, display-ready).
 */

import { api, type Page } from "@/shared/api/client";

//     View-model shapes                                                         

export interface OrderCurrency {
  code: string;
  symbol: string;
  decimal_places?: number;
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

/** Contract statuses, in lifecycle order (plus the off-path ones). */
export type OrderStatus =
  | "pending_payment"
  | "payment_processing"
  | "paid_verifying"
  | "sent_to_printer"
  | "in_production"
  | "handed_over"
  | "delivered"
  | "payment_failed"
  | "cancelled"
  | "fulfillment_exception"
  | "refunded"
  | "disputed";

/** Derived from the order status (the contract exposes payment progress through attempts). */
export type PaymentStatus = "pending" | "pending_verification" | "paid" | "failed";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pending payment",
  payment_processing: "Processing payment",
  paid_verifying: "Paid — verifying",
  sent_to_printer: "Sent to printer",
  in_production: "In production",
  handed_over: "Handed over",
  delivered: "Delivered",
  payment_failed: "Payment failed",
  cancelled: "Cancelled",
  fulfillment_exception: "Fulfillment issue",
  refunded: "Refunded",
  disputed: "Under dispute",
};

/** Statuses from which `POST /orders/{id}/cancel/` is accepted. */
export const CANCELLABLE: OrderStatus[] = [
  "pending_payment",
  "payment_processing",
  "paid_verifying",
  "sent_to_printer",
  "payment_failed",
  "fulfillment_exception",
];

/** Statuses where the order is still moving on its own after payment, so polling is worthwhile. */
export const SETTLING: OrderStatus[] = ["payment_processing", "paid_verifying"];

export interface OrderShipping {
  delivery_type: "delivery" | "pickup";
  vendor?: string;
  service_level?: string;
  address?: { full_name: string; phone: string; street: string; city_name: string; country_name: string };
  pickup_location?: { name: string; address: string; landmark: string; phone: string; instructions: string };
}

export interface OrderHistoryEntry {
  status: OrderStatus;
  reason: string;
  at: string;
}

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
  /** The list endpoint only returns a count; the first item is available on the detail. */
  first_item: null;
  created_at: string;
}

export interface OrderListResponse {
  data: OrderListItem[];
  pagination: { page: number; page_size: number; total: number; total_pages: number; has_next: boolean; has_previous: boolean };
}

export interface OrderDetail {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  delivery_type: "delivery" | "pickup";
  pricing: { subtotal: string; shipping_cost: string; discount: string; total: string; currency: OrderCurrency };
  shipping: OrderShipping;
  items: OrderItem[];
  item_count: number;
  customer_note: string;
  can_cancel: boolean;
  history: OrderHistoryEntry[];
  created_at: string;
  updated_at?: string;
  paid_at: string | null;
}

//     Raw contract shapes (only what we read)                                   

interface RawOrderSummary {
  id: string;
  /** Display reference (e.g. "MIMO-2026-00042"); falls back to a short id when absent. */
  order_number?: string;
  status: OrderStatus;
  currency_code_snapshot: string;
  currency_symbol_snapshot?: string;
  delivery_kind?: "delivery" | "pickup";
  total_amount: string;
  contains_physical: boolean;
  created_at: string;
  paid_at: string | null;
  item_count?: number;
}

interface RawOrder extends RawOrderSummary {
  currency_symbol_snapshot: string;
  currency_decimal_places_snapshot: number;
  subtotal_amount: string;
  shipping_amount: string;
  discount_amount: string;
  shipping_full_name: string;
  shipping_phone: string;
  shipping_line1: string;
  shipping_line2: string;
  shipping_city: string;
  shipping_country_code: string;
  delivery_kind?: "delivery" | "pickup";
  delivery_option_snapshot?: { name?: string; code?: string } | null;
  pickup_location_snapshot?: { name?: string; address?: string; phone?: string } | null;
  notes: string;
  updated_at?: string;
  items: {
    id: string;
    title: string;
    /** Contract v2: { scene_graph, variant, print_method, mockups: [{label,url,is_primary}] } */
    snapshot_data?: {
      variant?: unknown;
      mockups?: { label?: string; url: string; is_primary?: boolean }[];
    } | null;
    quantity: number;
    unit_price: string;
    line_total: string;
  }[];
  state_history: { to_status: OrderStatus; reason: string; created_at: string }[];
}

export const shortOrderRef = (id: string) => `#${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

export function paymentStatusOf(s: OrderStatus): PaymentStatus {
  switch (s) {
    case "pending_payment":
    case "cancelled":
      return "pending";
    case "payment_failed":
      return "failed";
    case "payment_processing":
      return "pending_verification";
    default:
      return "paid";
  }
}

/** `variant_snapshot` has no documented shape; read colour/size defensively. */
function variantParts(snap: unknown): { size: string; color_name: string; color_hex: string } {
  const s = (snap ?? {}) as Record<string, unknown>;
  const opts = (s["options"] ?? {}) as Record<string, unknown>;
  const col = s["color"];
  const colorName =
    (typeof col === "string" ? col : (col as { name?: string } | undefined)?.name) ?? (opts["color"] as string | undefined) ?? "";
  const colorHex = (col as { hex?: string } | undefined)?.hex ?? (s["color_hex"] as string | undefined) ?? "";
  const size = (typeof s["size"] === "string" ? (s["size"] as string) : (opts["size"] as string | undefined)) ?? "";
  return { size: size.toUpperCase(), color_name: colorName, color_hex: colorHex };
}

const sym = (r: { currency_symbol_snapshot?: string; currency_code_snapshot: string }) =>
  r.currency_symbol_snapshot || r.currency_code_snapshot;

export function mapOrderSummary(r: RawOrderSummary): OrderListItem {
  return {
    id: r.id,
    order_number: r.order_number || shortOrderRef(r.id),
    status: r.status,
    payment_status: paymentStatusOf(r.status),
    delivery_type: r.delivery_kind ?? "delivery",
    total: r.total_amount,
    currency_code: r.currency_code_snapshot,
    currency_symbol: r.currency_symbol_snapshot || r.currency_code_snapshot,
    item_count: r.item_count ?? 0,
    first_item: null,
    created_at: r.created_at,
  };
}

export function mapOrderDetail(r: RawOrder): OrderDetail {
  const kind = r.delivery_kind ?? "delivery";
  const pickup = r.pickup_location_snapshot;
  return {
    id: r.id,
    order_number: r.order_number || shortOrderRef(r.id),
    status: r.status,
    payment_status: paymentStatusOf(r.status),
    delivery_type: kind,
    pricing: {
      subtotal: r.subtotal_amount,
      shipping_cost: r.shipping_amount,
      discount: r.discount_amount,
      total: r.total_amount,
      currency: { code: r.currency_code_snapshot, symbol: sym(r), decimal_places: r.currency_decimal_places_snapshot },
    },
    shipping: {
      delivery_type: kind,
      ...(r.delivery_option_snapshot?.name ? { vendor: r.delivery_option_snapshot.name } : {}),
      ...(kind === "delivery"
        ? {
            address: {
              full_name: r.shipping_full_name,
              phone: r.shipping_phone,
              street: [r.shipping_line1, r.shipping_line2].filter(Boolean).join(", "),
              city_name: r.shipping_city,
              country_name: r.shipping_country_code,
            },
          }
        : pickup && pickup.name
          ? { pickup_location: { name: pickup.name, address: pickup.address ?? "", landmark: "", phone: pickup.phone ?? "", instructions: "" } }
          : {}),
    },
    items: (r.items ?? []).map((i) => ({
      id: i.id,
      product_name: i.title,
      ...variantParts(i.snapshot_data?.variant),
      quantity: i.quantity,
      unit_price: i.unit_price,
      subtotal: i.line_total,
      mockup_url: (i.snapshot_data?.mockups?.find((m) => m.is_primary) ?? i.snapshot_data?.mockups?.[0])?.url ?? "",
    })),
    item_count: r.items?.length ?? r.item_count ?? 0,
    customer_note: r.notes ?? "",
    can_cancel: CANCELLABLE.includes(r.status),
    history: (r.state_history ?? []).map((h) => ({ status: h.to_status, reason: h.reason, at: h.created_at })),
    created_at: r.created_at,
    updated_at: r.updated_at,
    paid_at: r.paid_at,
  };
}

//     API object                                                                

export const ordersApi = {
  list: async (params?: { page?: number; page_size?: number; status?: string }): Promise<OrderListResponse> => {
    const page = params?.page ?? 1;
    const page_size = params?.page_size ?? 20;
    const res = await api.get<Page<RawOrderSummary>>("/orders/", {
      params: { page, page_size, ordering: "-created_at", status: params?.status },
    });
    return {
      data: res.results.map(mapOrderSummary),
      pagination: {
        page,
        page_size,
        total: res.count,
        total_pages: Math.max(1, Math.ceil(res.count / page_size)),
        has_next: !!res.next,
        has_previous: page > 1,
      },
    };
  },

  detail: async (id: string): Promise<OrderDetail> => mapOrderDetail(await api.get<RawOrder>(`/orders/${id}/`)),

  /** Only allowed up to `sent_to_printer` (see CANCELLABLE); the server returns 400 otherwise. */
  cancel: async (id: string, reason: string): Promise<OrderDetail> =>
    mapOrderDetail(await api.post<RawOrder>(`/orders/${id}/cancel/`, { body: { reason } })),
};
