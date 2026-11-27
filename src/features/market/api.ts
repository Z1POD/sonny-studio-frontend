// src/features/market/api.ts


import { api, type Page } from "@/shared/api/client";
import {
  buildHomepage,
  flattenCategories,
  mapBlankListItem,
  mapCategories,
  mapPublishedDetail,
  mapPublishedListItem,
  pageOf,
  type RawBlankListItem,
  type RawCategoryNode,
  type RawPublishedDetail,
  type RawPublishedListItem,
} from "./contract";
import type { Viewer3D } from "@/features/studio/contract";
import type { CategoryCard, Homepage, ProductListItem, ProductListParams, ProductListResponse } from "./types";

export interface Currency {
  code: string;
  symbol: string;
  name?: string;
  decimal_places?: number;
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

export interface MockupImage {
  id: string;
  url: string;
  thumbnail_url: string;
  /** "front" | "back" | … (free text, shown as the image caption). */
  label: string;
  /** Garment colour this photo shows; null = valid for every colour. */
  color_id: string | null;
  is_primary: boolean;
  sort_order: number;
}

export interface SizeOption {
  id: string;
  /** Chip text, e.g. "M". */
  label: string;
}

/** A garment colour with its own sizes (a size can be sold out in one colour and not in another). */
export interface ColorOption {
  id: string;
  name: string;
  hex: string;
  /** At least one size of this colour can be bought. */
  available: boolean;
  sizes: (SizeOption & { available: boolean })[];
}

/** One orderable combination — the unit that goes in the bag and on an order line. */
export interface VariantInfo {
  variant_id: string;
  sku: string;
  color_id: string;
  size_id: string;
  available: boolean;
  /** Units left; null = not tracked / plenty. */
  stock_quantity: number | null;
  /** Decimal string — the price of THIS variant. */
  price: string;
}

export interface ProductDetails {
  name?: string;
  brand?: string;
  fit?: string;
  material?: string;
  weight_grams?: number;
  care_instructions?: string;
}

export interface ProductStats {
  view_count: number;
  sold_quantity: number;
}

export interface ProductDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  store: ProductStoreSummary;
  pricing: {
    /** Lowest variant price ("From"). */
    retail_price: string;
    currency: Currency;
  };
  colors: ColorOption[];
  variants: VariantInfo[];
  default_variant_id: string | null;
  mockups: MockupImage[];
  thumbnail_url: string;
  /** Present only when the product can be shown in 3D. */
  viewer3d: Viewer3D | null;
  details: ProductDetails;
  stats: ProductStats;
  tags: string[];
  created_at: string;
  related_products: ProductListItem[];

  /* ── ids used to build orders / open the studio ── */
  /** The design an order line is created from (`design_id` at checkout). */
  design_id: string;
  published_product_id: string;
  /** Slug of the blank this design is printed on. */
  blank_slug: string;
  allows_customization_on_top: boolean;
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
  /** "From" price of the design; the exact price is quoted at checkout. */
  unit_price: number;
  currency: Currency;
  store: ProductStoreSummary;
  /** Contract ids used to build the order line. */
  design_id: string;
  variant_id: string;
  /** Units available when added (null = untracked); caps the bag quantity. */
  max_quantity?: number | null;
}

/**
 * Query params the backend reads directly off the `/market/p/<slug>/`
 * request itself — `code` affects the response (applied_coupon /
 * pricing), `ref`/`utm_*` are read by TrafficService purely for view
 * attribution. Both need to travel on the actual API call, not just sit
 * in the page's browser URL.
 */
export interface ProductDetailParams {
  ref?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

const PUBLIC = { auth: false } as const;

async function listPublished(params: ProductListParams) {
  const page = params.page ?? 1;
  const page_size = params.page_size ?? 12;
  const res = await api.get<Page<RawPublishedListItem>>("/products/published/", {
    ...PUBLIC,
    params: {
      search: params.q,
      category: params.category,
      brand: params.brand,
      // Only `-published_at` is documented; other sorts fall back to newest first.
      ordering: "-published_at",
      page,
      page_size,
    },
  });
  const items = res.results.filter((r) => r.is_active !== false).map(mapPublishedListItem);
  return pageOf(items, res.count, res.next, page, page_size);
}

export const marketApi = {
  /** Synthesised from the newest published products + the category tree. */
  getHomepage: async (): Promise<Homepage> => {
    const [list, tree] = await Promise.all([
      listPublished({ page_size: 12 }),
      api.get<RawCategoryNode[]>("/catalog/categories/tree/", PUBLIC).catch(() => [] as RawCategoryNode[]),
    ]);
    return buildHomepage(list.products, mapCategories(tree));
  },

  listProducts: (params: ProductListParams = {}) => listPublished(params),

  /** Blank products the buyer can customize (category filter includes descendants). */
  listBlanks: async (params: ProductListParams = {}): Promise<ProductListResponse> => {
    const page = params.page ?? 1;
    const page_size = params.page_size ?? 12;
    const res = await api.get<Page<RawBlankListItem>>("/catalog/blank-products/", {
      ...PUBLIC,
      params: { search: params.q, category: params.category, brand: params.brand, page, page_size },
    });
    const items = res.results.filter((r) => r.is_active !== false).map(mapBlankListItem);
    return pageOf(items, res.count, res.next, page, page_size);
  },

  getCategories: async (): Promise<CategoryCard[]> =>
    flattenCategories(await api.get<RawCategoryNode[]>("/catalog/categories/tree/", PUBLIC)),

  /** Public. `ref` / `utm_*` travel on the request itself: the server uses them to attribute the view it counts. */
  getProduct: async (slug: string, params: ProductDetailParams = {}): Promise<ProductDetail> =>
    mapPublishedDetail(
      await api.get<RawPublishedDetail>(`/products/published/${encodeURIComponent(slug)}/`, { ...PUBLIC, params: { ...params } }),
    ),
};
