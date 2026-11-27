/**
 * src/features/store/api.ts — the creator's designs ("products") in their store.
 *
 * A design is created by the shared studio endpoint (`POST /studio/designs/` with `purpose: "listing"`), which
 * returns a draft. Its id IS the product id used here. Creator-only concerns (markup, which variants to sell,
 * limited edition, publish / archive / delete) live under `/store/products/`.
 *
 * Conventions shared with the buyer app: bare JSON bodies, DRF page envelope, `Money` objects for prices,
 * `variant_matrix { colors, sizes, combinations }`, mockups with `color_id`, errors as `{ error: { code, message } }`.
 */

import { formatPrice } from "@/lib/format";
import { api, type Page } from "@/shared/api/client";
import type { Currency } from "@/shared/api/types";

//     Wire shapes                                                              

export interface Money {
  amount: string;
  currency_code: string;
  currency_symbol: string;
  currency_decimal_places: number;
}

export interface ProductBlankRef {
  id: string;
  slug: string;
  name: string;
}

export type PublishBlocker = "markup_required" | "no_variants" | "no_mockups";

/**
 * `pending_review`: the creator submitted it and staff haven't approved yet. Publishing never goes live directly —
 * only an approved review activates the listing.
 */
export type ProductStatus = "draft" | "pending_review" | "published" | "archived";

export interface ProductListItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail_url: string | null;
  status: ProductStatus;
  is_published: boolean;
  /** What a buyer pays per item: blank + print + markup. */
  price: Money;
  sold_quantity: number;
  /** Absolute URL of the buyer-app product page (empty until published). */
  public_link: string;
  production_ready: boolean;
  /** The blank this design is printed on — `blank.slug` re-opens it in the studio. */
  blank: ProductBlankRef;
  /** Buyers may add their own artwork on top of this design. */
  allows_customization_on_top?: boolean;
  /** Private listings are unlisted after approval — reachable only through the share link. */
  is_private?: boolean;
  /** Ids of discount rules currently applied to this product. */
  applied_discount_rule_ids: string[];
  /** Empty ⇒ publishable. The server enforces the same rules on `publish` (`400 publish_blocked`). */
  publish_blockers: PublishBlocker[];
  created_at: string;
  updated_at: string;
}

export interface ProductMockup {
  id: string;
  angle: string;
  url: string;
  thumbnail_url?: string | null;
  /** `variant_matrix.colors[].id`, or null for "all colours". */
  color_id: string | null;
  is_primary: boolean;
  display_order: number;
}

export interface ProductPricing {
  currency: Currency;
  /** Blank garment cost. */
  base_price: string;
  /** Print cost for the chosen method(s) and zones — computed by the server. */
  print_cost: string;
  /** The creator's margin, an absolute amount per item. */
  markup_price: string;
  /** base + print + markup. */
  retail_price: string;
}

export interface ProductColor {
  id: string;
  name: string;
  hex: string;
  sort_order?: number;
}

export interface ProductSize {
  id: string;
  code: string;
  label: string;
  sort_order?: number;
}

/** One colour × size of the blank — EVERY combination is listed, with whether the creator sells it. */
export interface ProductVariantRow {
  variant_id: string;
  sku: string;
  color_id: string;
  size_id: string;
  enabled: boolean;
  in_stock: boolean;
  stock_quantity: number | null;
  price: string;
}

export interface ProductVariantMatrix {
  colors: ProductColor[];
  sizes: ProductSize[];
  combinations: ProductVariantRow[];
}

export interface ProductDetail extends ProductListItem {
  mockups: ProductMockup[];
  pricing: ProductPricing;
  variant_matrix: ProductVariantMatrix;
  is_limited_edition: boolean;
  max_quantity: number | null;
  stats: { view_count: number; share_count: number; sold_quantity: number };
}

export interface UpdateProductPayload {
  title?: string;
  description?: string;
  /** Absolute amount per item (decimal string). */
  markup_price?: string;
  /** Variant ids to sell; every other variant of the blank is switched off. */
  enabled_variant_ids?: string[];
  is_limited_edition?: boolean;
  max_quantity?: number | null;
  /** Let buyers customize on top of this design in the studio. */
  allows_customization_on_top?: boolean;
  /** Listing visibility (drafts only): private = unlisted after approval, share link only. */
  is_private?: boolean;
}

/** Submitted for moderation and waiting for staff (not live yet). */
export const isPendingReview = (p: Pick<ProductListItem, "status">): boolean => p.status === "pending_review";

/** First reason a design can't be published yet, as readable text (null when it can). */
export function publishBlockerMessage(p: Pick<ProductListItem, "publish_blockers">): string | null {
  const first = p.publish_blockers?.[0];
  return first ? PUBLISH_BLOCKER_TEXT[first] : null;
}

export const PUBLISH_BLOCKER_TEXT: Record<PublishBlocker, string> = {
  markup_required: "Set a markup above 0 so you earn something on each sale",
  no_variants: "Enable at least one colour and size",
  no_mockups: "Open the studio and save the design to generate mockups",
};

//     Helpers                                                                  

export function priceCurrency(m: Money): Currency {
  return { code: m.currency_code, symbol: m.currency_symbol || m.currency_code, decimal_places: m.currency_decimal_places };
}

export function getRetailPrice(item: Pick<ProductListItem, "price">): string {
  if (!item.price) return "—";
  return formatPrice(item.price.amount, priceCurrency(item.price));
}

/** Enabled variants grouped by colour with their sizes (for read-only summaries). */
export function enabledByColor(matrix: ProductVariantMatrix) {
  return matrix.colors
    .map((color) => ({
      color,
      sizes: matrix.sizes
        .filter((s) => matrix.combinations.some((c) => c.color_id === color.id && c.size_id === s.id && c.enabled))
        .map((s) => s.label),
    }))
    .filter((g) => g.sizes.length > 0);
}

//     API                                                                      

export const storeProductApi = {
  list: (params?: { page?: number; page_size?: number; status?: string }) =>
    api.get<Page<ProductListItem>>("/store/products/", {
      params: { page: params?.page ?? 1, page_size: params?.page_size ?? 20, status: params?.status },
    }),

  detail: (id: string) => api.get<ProductDetail>(`/store/products/${encodeURIComponent(id)}/`),

  /** Partial update — omitted fields are left unchanged. */
  update: (id: string, payload: UpdateProductPayload) =>
    api.patch<ProductDetail>(`/store/products/${encodeURIComponent(id)}/`, { body: payload }),

  /** `400 publish_blocked` (with a readable message) when `publish_blockers` isn't empty. */
  publish: (id: string) =>
    api.post<{ id: string; status: ProductStatus; is_published: boolean; review_id?: string | null; public_link: string }>(
      `/store/products/${encodeURIComponent(id)}/publish/`,
      { body: {} },
    ),

  archive: (id: string) => api.post<null>(`/store/products/${encodeURIComponent(id)}/archive/`, { body: {} }),

  /** `409` while the design has orders (archive it instead). */
  deleteProduct: (id: string) => api.delete<null>(`/store/products/${encodeURIComponent(id)}/`),
};
