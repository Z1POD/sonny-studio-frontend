// src/features/market/api.ts
//
// Marketplace API wrappers, using the real Sonny client (@/shared/api/client).
//
// This file also owns the full single-product shape (`ProductDetail`,
// `ColorVariant`, `CartItem`, etc.) — there's no external `@/types/api` in
// this project, so everything the detail page and cart store need is
// defined here rather than assumed, keeping the market feature
// self-contained.

import { api } from "@/shared/api/client";
import type {
  CategoryDetail,
  Homepage,
  ProductListParams,
  ProductListResponse,
  StoreDetail,
  WishlistToggleResult,
} from "./types";

interface Envelope<T> {
  success: boolean;
  data: T;
}

export interface Currency {
  code: string;
  symbol: string;
  name?: string;
}

export interface ColorVariant {
  name: string;
  hex: string;
  sizes: string[];
  prices?: Record<string, string>;
}

export interface MockupImage {
  id: string;
  type: string;
  url: string;
  is_primary: boolean;
  sort_order: number;
}

export interface ApparelInfo {
  name?: string;
  fit?: string;
  brand?: string;
  weight_grams?: number;
  care_instructions?: string;
}

export interface ReviewsSummary {
  average_rating: number;
  total_reviews: number;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
}

export interface ProductStats {
  view_count: number;
  sold_quantity: number;
  wishlist_count: number;
}

export interface ProductStoreSummary {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  rating: number;
  review_count: number;
  product_count: number;
  is_verified: boolean;
}

export interface RelatedProduct {
  id: string;
  title: string;
  slug: string;
  thumbnail_url: string;
  mockup_url?: string | null;
  retail_price: string;
  currency: Currency;
  store: { name: string; slug: string };
  rating: number;
  review_count: number;
  sold_quantity: number;
  is_limited_edition: boolean;
  created_at: string;
}

export interface ProductDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  public_link?: string;
  store: ProductStoreSummary;
  pricing: {
    retail_price: string;
    currency: Currency;
  };
  variants: {
    colors: ColorVariant[];
    sizes: string[];
  };
  mockups: MockupImage[];
  thumbnail_url: string;
  // 3D viewer config exists in the contract but isn't used by this
  // (image-first) detail page — kept loose on purpose.
  viewer_3d?: unknown;
  apparel_info?: ApparelInfo;
  reviews_summary: ReviewsSummary;
  stats: ProductStats;
  is_limited_edition: boolean;
  max_quantity: number | null;
  available_quantity: number | null;
  tags: string[];
  created_at: string;
  user_context?: {
    is_in_wishlist: boolean;
    has_purchased: boolean;
    can_review: boolean;
  };
  related_products: RelatedProduct[];
}

/**
 * A single line in the marketplace cart (`./store.ts`). One entry per
 * product + color + size combination.
 */
export interface CartItem {
  cart_id: string;
  product_id: string;
  slug: string;
  title: string;
  thumbnail_url: string;
  mockup_url?: string | null;
  color_name: string;
  color_hex: string;
  size: string;
  quantity: number;
  unit_price: number;
  currency: Currency;
  store: ProductStoreSummary;
}

export const marketApi = {
  getHomepage: () => api.get<Envelope<Homepage>>("/market/").then((r) => r.data),

  listProducts: (params: ProductListParams = {}) =>
    api
      .get<Envelope<ProductListResponse>>("/market/products/", {
        params: { ...params },
      })
      .then((r) => r.data),

  searchSuggestions: (q: string) =>
    api
      .get<Envelope<string[]>>("/market/search/suggestions/", { params: { q } })
      .then((r) => r.data),

  getProduct: (slug: string) =>
    api.get<Envelope<ProductDetail>>(`/market/p/${slug}/`).then((r) => r.data),

  getStore: (slug: string) =>
    api.get<Envelope<StoreDetail>>(`/market/stores/${slug}/`).then((r) => r.data),

  getCategory: (slug: string) =>
    api.get<Envelope<CategoryDetail>>(`/market/categories/${slug}/`).then((r) => r.data),

  addToWishlist: (product_id: string) =>
    api
      .post<Envelope<WishlistToggleResult>>("/market/wishlist/", {
        body: { product_id },
      })
      .then((r) => r.data),

  removeFromWishlist: (product_id: string) =>
    api
      .delete<Envelope<WishlistToggleResult>>(`/market/wishlist/${product_id}/`)
      .then((r) => r.data),
};