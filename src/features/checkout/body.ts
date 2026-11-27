// Builds the contract request body shared by `POST /orders/checkout/validate/` and `POST /orders/`.

import { api } from "@/shared/api/client";
import { useAuthStore } from "@/features/auth/store";
import type { CheckoutBody } from "./api";
import type { City, CheckoutItem, FulfillmentType, ShippingAddress, ShippingOptions } from "./types";

let currencyFallback: Promise<string | undefined> | null = null;
/** The buyer's preferred currency, or the first active one when none is set. */
export async function resolveCurrencyId(): Promise<string | undefined> {
  const pref = useAuthStore.getState().user?.preferred_currency?.id;
  if (pref) return pref;
  currencyFallback ??= api
    .get<{ id: string; is_active?: boolean }[]>("/currencies/", { auth: false })
    .then((list) => list.find((c) => c.is_active !== false)?.id)
    .catch(() => undefined);
  return currencyFallback;
}

export interface BodyInput {
  items: CheckoutItem[];
  shippingAddress: ShippingAddress;
  fulfillmentType: FulfillmentType;
  selectedVendorCode: string;
  selectedPickupId: string;
  shippingOptions: ShippingOptions | null;
  cities: City[];
  currencyId?: string;
}

/** Returns null until the delivery choice is complete. */
export function buildCheckoutBody(i: BodyInput): CheckoutBody | null {
  const user = useAuthStore.getState().user;
  const a = i.shippingAddress;
  const pickup = i.shippingOptions?.pickup.find((p) => p.locationId === i.selectedPickupId);
  const deliveryOptionId = i.fulfillmentType === "pickup" ? pickup?.deliveryOptionId : i.selectedVendorCode;
  if (!deliveryOptionId || i.items.length === 0) return null;
  if (i.fulfillmentType === "pickup" && !pickup) return null;

  const fullName = a.fullName || user?.display_name || "";
  const body: CheckoutBody = {
    schema_version: "1.0",
    ...(i.currencyId ? { currency_id: i.currencyId } : {}),
    items: i.items.map((it) => ({ design_id: it.designId, variant_id: it.variantId, quantity: it.quantity })),
    contact: { full_name: fullName, phone: a.phone, ...(user?.email ? { email: user.email } : {}) },
    delivery_option_id: deliveryOptionId,
    notes: a.deliveryInstructions ?? "",
  };
  if (i.fulfillmentType === "pickup") {
    body.pickup_location_id = pickup!.locationId; // shipping_address must be omitted for pickup
  } else {
    const city = i.cities.find((c) => c.id === a.cityId);
    body.shipping_address = {
      full_name: fullName,
      phone: a.phone,
      line1: a.street,
      line2: "",
      city: a.cityName || city?.name || "",
      state: a.state,
      postal_code: a.postalCode ?? "",
      country_code: city?.countryCode ?? "ET",
    };
  }
  return body;
}
