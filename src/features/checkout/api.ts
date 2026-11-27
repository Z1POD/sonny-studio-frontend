// src/features/checkout/api.ts
//
//   GET  /shipping/destinations/          cities + delivery options + pickup locations (cache per session)
//   POST /orders/checkout/validate/       authoritative totals (dry run)
//   POST /orders/                         create order (idempotent via `idempotency_key` in the body)

import { api } from "@/shared/api/client";
import type { City, CheckoutQuote, DeliveryOption, OrderResponse, PickupLocation, ShippingOptions } from "./types";
import { shortOrderRef } from "@/features/orders/api";

//     Destinations                                                              

interface RawDeliveryOption {
  id: string;
  name: string;
  code: string;
  kind: "delivery" | "pickup";
  base_fee: string;
  currency_code: string;
  min_days: number;
  max_days: number;
}

interface RawPickupLocation {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  opening_hours?: Record<string, { start: string; end: string }[]>;
}

interface RawDestination {
  id: string;
  name: string;
  region: string;
  country_code: string;
  delivery_options: RawDeliveryOption[];
  pickup_locations: RawPickupLocation[];
}

let destinations: Promise<RawDestination[]> | null = null;
/** One request per checkout session. */
const loadDestinations = () => {
  destinations ??= api.get<RawDestination[]>("/shipping/destinations/", { auth: false }).catch((e) => {
    destinations = null;
    throw e;
  });
  return destinations;
};

const days = (o: { min_days: number; max_days: number }) =>
  o.max_days <= 1 && o.min_days === 0 ? "Same day – 1 day" : o.min_days === o.max_days ? `${o.max_days} days` : `${o.min_days}-${o.max_days} days`;

const hours = (oh?: RawPickupLocation["opening_hours"]) => {
  const names: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
  return Object.entries(oh ?? {})
    .filter(([, v]) => v.length)
    .map(([d, v]) => `${names[d] ?? d} ${v.map((r) => `${r.start}–${r.end}`).join(", ")}`)
    .join(" · ");
};

export function mapDestination(d: RawDestination): { city: City; options: ShippingOptions } {
  const delivery: DeliveryOption[] = d.delivery_options
    .filter((o) => o.kind === "delivery")
    .map((o) => ({
      vendorCode: o.id, // the delivery option id is what checkout sends
      vendorName: o.name,
      serviceName: o.name,
      serviceLevel: o.code === "express" ? "express" : "standard",
      cost: o.base_fee,
      currency: o.currency_code,
      estimatedDays: days(o),
      isFree: parseFloat(o.base_fee) === 0,
    }));
  const pickupOpt = d.delivery_options.filter((o) => o.kind === "pickup");
  const pickup: PickupLocation[] = pickupOpt.length
    ? d.pickup_locations.map((l) => {
        // Prefer the pickup option named after this location (e.g. "pickup-bole" ↔ "bole"), else the first.
        const opt = pickupOpt.find((o) => o.code.includes(l.code)) ?? pickupOpt[0]!;
        return {
          locationId: l.id,
          deliveryOptionId: opt.id,
          name: l.name,
          address: l.address,
          phone: l.phone,
          instructions: hours(l.opening_hours),
          estimatedDays: days(opt),
          cost: opt.base_fee,
          currency: opt.currency_code,
          isFree: parseFloat(opt.base_fee) === 0,
        };
      })
    : [];
  return { city: { id: d.id, name: d.name, state: d.region, countryCode: d.country_code }, options: { delivery, pickup } };
}

//     Validate & create                                                         

export interface CheckoutBody {
  schema_version: "1.0";
  currency_id?: string;
  items: { design_id: string; variant_id: string; quantity: number }[];
  contact: { full_name: string; phone: string; email?: string };
  delivery_option_id: string;
  pickup_location_id?: string;
  shipping_address?: {
    full_name: string;
    phone: string;
    line1: string;
    line2: string;
    city: string;
    state: string;
    postal_code: string;
    country_code: string;
  };
  notes: string;
}

interface RawValidate {
  currency_code: string;
  subtotal_amount: string;
  tax_amount: string;
  shipping_amount: string;
  discount_amount: string;
  total_amount: string;
  items: {
    design_id: string;
    variant_id: string;
    quantity: number;
    price_breakdown: {
      currency_symbol: string;
      currency_decimal_places: number;
      unit_price: string;
      line_total: string;
    };
  }[];
}

interface RawOrderCreated {
  id: string;
  order_number?: string;
  status: string;
  currency_code_snapshot: string;
  currency_symbol_snapshot: string;
  currency_decimal_places_snapshot: number;
  total_amount: string;
}

export const checkoutApi = {
  getCities: async (): Promise<City[]> => (await loadDestinations()).map((d) => mapDestination(d).city),

  /** Options are already scoped to the city — no extra request. */
  getShippingOptions: async (cityId: string): Promise<ShippingOptions> => {
    const d = (await loadDestinations()).find((x) => x.id === cityId);
    return d ? mapDestination(d).options : { delivery: [], pickup: [] };
  },

  validate: async (body: CheckoutBody): Promise<CheckoutQuote> => {
    const r = await api.post<RawValidate>("/orders/checkout/validate/", { body });
    const pb = r.items[0]?.price_breakdown;
    return {
      currency: { code: r.currency_code, symbol: pb?.currency_symbol ?? r.currency_code, decimal_places: pb?.currency_decimal_places ?? 2 },
      subtotal: r.subtotal_amount,
      shipping: r.shipping_amount,
      tax: r.tax_amount,
      discount: r.discount_amount,
      total: r.total_amount,
      lines: r.items.map((i) => ({
        designId: i.design_id,
        variantId: i.variant_id,
        quantity: i.quantity,
        unitPrice: i.price_breakdown.unit_price,
        lineTotal: i.price_breakdown.line_total,
      })),
    };
  },

  /** 201 = new order, 200 = replay of the same idempotency key. */
  createOrder: async (body: CheckoutBody, idempotencyKey: string): Promise<OrderResponse> => {
    const o = await api.post<RawOrderCreated>("/orders/", { body: { ...body, idempotency_key: idempotencyKey } });
    return {
      id: o.id,
      orderNumber: o.order_number || shortOrderRef(o.id),
      status: o.status,
      total: o.total_amount,
      currency: { code: o.currency_code_snapshot, symbol: o.currency_symbol_snapshot, decimal_places: o.currency_decimal_places_snapshot },
    };
  },
};
