// src/features/market/api.ts
//
// Marketplace API wrappers, using the real Sonny client (@/shared/api/client).
//
// This file also owns the full single-product shape (`ProductDetail`,
// `ColorVariant`, `CartItem`, etc.) — there's no external `@/types/api` in
// this project, so everything the detail page and cart store need is
// defined here rather than assumed, keeping the market feature
// self-contained.
//
// `Viewer3D` / `ViewerPrintArea` were added to back the marketplace's 3D
// product viewer (see `./components/viewer`). Shape matches the
// `viewer_3d` block the backend returns on `ProductDetail` (snake_case,
// per-print-area baked-in `decal`).

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

/* 3D viewer */

/** A design layer already baked into a print area's decal — informational
 *  only on this (read-only) marketplace viewer; the decal itself is what
 *  gets rendered. */
export interface PrintAreaDesignLayer {
  type: string;
  url: string;
  offset_x: number;
  offset_y: number;
  scale: number;
  rotation: number;
  z_index?: number;
}

export interface PrintAreaDecal {
  url: string;
  aspect_ratio: number;
  scale: number;
  rotation: number;
  offset_x: number;
  offset_y: number;
  size_tier?: string;
}

export interface PrintAreaWorldBounds {
  center: [number, number, number];
  half_extents: [number, number, number];
  rotation?: [number, number, number];
}

export interface PrintAreaTransformLimits {
  min_scale: number;
  max_scale: number;
  min_x?: number;
  max_x?: number;
  min_y?: number;
  max_y?: number;
}

export interface PrintAreaUvConfig {
  world_bounds?: PrintAreaWorldBounds;
  transform_limits?: PrintAreaTransformLimits;
  uv_bounds?: { min_u: number; min_v: number; max_u: number; max_v: number };
}

export interface ViewerPrintArea {
  area_key: string;
  name: string;
  placement: string; // "front" | "back" | "left_sleeve" | "right_sleeve" | "hood" | "full" ...
  width_cm: number | string;
  height_cm: number | string;
  mesh_name?: string;
  uv_config?: PrintAreaUvConfig;
  design?: { layers?: PrintAreaDesignLayer[] };
  decal?: PrintAreaDecal | null;
}

export interface Viewer3D {
  model_url?: string;
  usdz_url?: string;
  preview_url?: string;
  background?: string;
  environment?: string;
  model_position?: [number, number, number];
  colorable_meshes?: string[];
  default_view?: string;
  material?: {
    texture_url?: string | null;
    normal_map_url?: string | null;
    roughness?: number;
    metalness?: number;
  };
  lighting?: {
    type?: string;
    intensity?: number;
    ambient?: number;
    key?: { position: [number, number, number]; intensity: number };
    fill?: { position: [number, number, number]; intensity: number };
    rim?: { position: [number, number, number]; intensity: number };
  };
  camera?: {
    position?: [number, number, number];
    fov?: number;
    orbit?: {
      min_distance?: number;
      max_distance?: number;
      min_polar_angle?: number;
      max_polar_angle?: number;
      enable_pan?: boolean;
      enable_zoom?: boolean;
    };
  };
  contact_shadows?: {
    enabled?: boolean;
    position?: [number, number, number];
    opacity?: number;
    scale?: number;
    blur?: number;
    far?: number;
  };
  print_areas?: ViewerPrintArea[];
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
  /** 3D viewer config — present when the product has a rigged GLB model. */
  viewer_3d?: Viewer3D;
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