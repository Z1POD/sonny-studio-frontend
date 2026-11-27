// src/features/market/store.ts
//
// Cart + cart-drawer state for the marketplace. Scoped entirely to
// `features/market`; types come from `./api` so this stays self-contained.
//
// Note: unlike the reference implementation this was adapted from, cart
// items don't carry an `apparel_type` — nothing in CartDrawer reads it, and
// keeping it out avoids a dependency on an external apparel-inference helper.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, ProductDetail } from "./api";

export type AddResult =
  | { ok: true; quantity: number; capped: boolean }
  | { ok: false; reason: "unavailable" | "max_reached" };

interface CartState {
  items: CartItem[];
  drawerOpen: boolean;
  checkoutOpen: boolean;

  openDrawer: () => void;
  closeDrawer: () => void;
  openCheckout: () => void;
  closeCheckout: () => void;

  /** Adds a variant of a product. Never exceeds the variant's stock; says why when it can't add. */
  add: (product: ProductDetail, variantId: string, qty?: number) => AddResult;
  remove: (cart_id: string) => void;
  setQty: (cart_id: string, qty: number) => void;
  clear: () => void;

  subtotal: () => number;
  count: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      drawerOpen: false,
      checkoutOpen: false,

      openDrawer: () => set({ drawerOpen: true }),
      closeDrawer: () => set({ drawerOpen: false }),
      openCheckout: () => set({ checkoutOpen: true, drawerOpen: false }),
      closeCheckout: () => set({ checkoutOpen: false }),

      add: (product, variantId, qty = 1) => {
        const variant = product.variants.find((v) => v.variant_id === variantId);
        const color = product.colors.find((c) => c.id === variant?.color_id);
        const size = color?.sizes.find((z) => z.id === variant?.size_id);
        if (!variant || !color || !size || !variant.available) return { ok: false, reason: "unavailable" };

        const cart_id = `${product.design_id}__${variant.variant_id}`;
        const max = variant.stock_quantity;
        const existing = get().items.find((i) => i.cart_id === cart_id);
        const have = existing?.quantity ?? 0;
        const wanted = have + qty;
        const next = max == null ? wanted : Math.min(wanted, max);
        if (next <= have) return { ok: false, reason: "max_reached" };

        if (existing) {
          set({ items: get().items.map((i) => (i.cart_id === cart_id ? { ...i, quantity: next, max_quantity: max } : i)) });
        } else {
          const colorMockup = product.mockups.find((m) => m.color_id === color.id && m.is_primary) ??
            product.mockups.find((m) => m.color_id === color.id);
          set({
            items: [
              ...get().items,
              {
                cart_id,
                product_id: product.id,
                design_id: product.design_id,
                variant_id: variant.variant_id,
                slug: product.slug,
                title: product.title,
                thumbnail_url: product.thumbnail_url,
                mockup_url: colorMockup?.url ?? product.mockups.find((m) => m.is_primary)?.url ?? product.mockups[0]?.url,
                color_name: color.name,
                color_hex: color.hex,
                size: size.label,
                quantity: next,
                unit_price: parseFloat(variant.price) || 0,
                currency: product.pricing.currency,
                store: product.store,
                max_quantity: max,
              },
            ],
          });
        }
        return { ok: true, quantity: next, capped: next < wanted };
      },

      remove: (cart_id) => set({ items: get().items.filter((i) => i.cart_id !== cart_id) }),

      setQty: (cart_id, qty) =>
        set({
          items: get()
            .items.map((i) =>
              i.cart_id === cart_id
                ? { ...i, quantity: Math.min(Math.max(1, qty), i.max_quantity ?? Number.MAX_SAFE_INTEGER) }
                : i,
            )
            .filter((i) => i.quantity > 0),
        }),

      clear: () => set({ items: [] }),

      subtotal: () => get().items.reduce((s, i) => s + i.unit_price * i.quantity, 0),
      count: () => get().items.reduce((s, i) => s + i.quantity, 0),
    }),
    { name: "market-cart-v2", partialize: (s) => ({ items: s.items }) },
  ),
);