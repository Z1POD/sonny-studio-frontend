// src/features/market/store.ts
//
// Cart + cart-drawer state for the marketplace, built from scratch for this
// feature — there's no pre-existing cart store elsewhere in the project.
// Scoped entirely to `features/market`; types come from `./api` so this
// stays self-contained.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, ColorVariant, ProductDetail } from "./api";



interface CartState {
  items: CartItem[];
  drawerOpen: boolean;
  checkoutOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  openCheckout: () => void;
  closeCheckout: () => void;
  add: (product: ProductDetail, color: ColorVariant, size: string, qty?: number) => void;
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
      add: (product, color, size, qty = 1) => {
        const cart_id = `${product.id}__${color.name}__${size}`;
        const existing = get().items.find((i) => i.cart_id === cart_id);
        if (existing) {
          set({
            items: get().items.map((i) =>
              i.cart_id === cart_id ? { ...i, quantity: i.quantity + qty } : i,
            ),
          });
          return;
        }
        const unit = parseFloat(color.prices?.[size] ?? product.pricing.retail_price);
        set({
          items: [
            ...get().items,
            {
              cart_id,
              product_id: product.id,
              slug: product.slug,
              title: product.title,
              thumbnail_url: product.thumbnail_url,
              mockup_url: product.mockups[0]?.url,
              color_name: color.name,
              color_hex: color.hex,
              size,
              quantity: qty,
              unit_price: unit,
              currency: product.pricing.currency,
              store: product.store,
            },
          ],
        });
      },
      remove: (cart_id) => set({ items: get().items.filter((i) => i.cart_id !== cart_id) }),
      setQty: (cart_id, qty) =>
        set({
          items: get()
            .items.map((i) => (i.cart_id === cart_id ? { ...i, quantity: Math.max(1, qty) } : i))
            .filter((i) => i.quantity > 0),
        }),
      clear: () => set({ items: [] }),
      subtotal: () => get().items.reduce((s, i) => s + i.unit_price * i.quantity, 0),
      count: () => get().items.reduce((s, i) => s + i.quantity, 0),
    }),
    { name: "ml-cart", partialize: (s) => ({ items: s.items }) },
  ),
);
