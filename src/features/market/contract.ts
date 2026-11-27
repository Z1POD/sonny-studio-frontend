// src/features/market/contract.ts
//
// Raw shapes of the marketplace endpoints in the Buyer Frontend API contract and
// the pure mappers that turn them into the view models the market UI renders.

import type {
  CategoryCard,
  Currency,
  Homepage,
  ProductListItem,
  ProductListResponse,
} from "./types";
import { mapViewer3D, type RawViewer3D } from "@/features/studio/contract";
import type { ColorOption, MockupImage, ProductDetail, VariantInfo } from "./api";

export interface RawMoney {
  amount: string;
  currency_code: string;
  currency_symbol: string;
  currency_decimal_places: number;
}

export interface RawOwner {
  id: string | number;
  display_name: string;
  avatar_url?: string | null;
}

export interface RawPublishedListItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  /** Primary mockup (card thumbnail). */
  thumbnail_url: string | null;
  mockup_url: string | null;
  /** Lowest price a buyer can pay ("From"). */
  price: RawMoney | null;
  owner: RawOwner;
  blank_product_id: string;
  sold_quantity?: number;
  view_count?: number;
  /** False when every variant is sold out. */
  in_stock?: boolean;
  allows_customization_on_top?: boolean;
  is_active?: boolean;
  published_at: string;
}

export interface RawMockup {
  id: string;
  url: string;
  thumbnail_url?: string | null;
  label: string;
  /** `variant_matrix.colors[].id` this photo shows; null = every colour. */
  color_id?: string | null;
  is_primary: boolean;
  display_order: number;
}

export interface RawVariantMatrix {
  colors: { id: string; code: string; name: string; hex: string; sort_order?: number }[];
  sizes: { id: string; code: string; label: string; sort_order?: number }[];
  combinations: {
    variant_id: string;
    sku: string;
    /** Either flat ids or the `options` map ({color, size}) the backend sends; the mapper accepts both. */
    color_id?: string;
    size_id?: string;
    options?: Record<string, string>;
    available: boolean;
    /** null = not tracked. */
    stock_quantity?: number | null;
    /** Decimal string — this variant's price. */
    price: string;
  }[];
}

export interface RawPublishedDetail extends RawPublishedListItem {
  design: {
    id: string;
    blank_product_id: string;
    blank_product_slug: string;
    blank_product_name: string;
    default_variant_id: string | null;
  };
  variant_matrix: RawVariantMatrix;
  mockups: RawMockup[];
  /** null / absent → the page has no 3D toggle. */
  viewer_3d?: RawViewer3D | null;
  details?: {
    name?: string;
    brand?: string;
    fit?: string;
    material?: string;
    weight_grams?: number;
    care_instructions?: string;
  };
  tags?: string[];
  stats: { view_count: number; sold_quantity: number };
  related_products?: RawPublishedListItem[];
}

export interface RawBlankListItem {
  id: string;
  name: string;
  slug: string;
  product_type: string;
  fit_style: string;
  brand?: { id: string; name: string; slug: string } | null;
  categories: { id: string; name: string; slug: string; path: string }[];
  thumbnail_url: string | null;
  mockup_url: string | null;
  currency_code: string;
  is_active?: boolean;
  created_at: string;
}

export interface RawCategoryNode {
  id: string;
  name: string;
  slug: string;
  path: string;
  icon?: string;
  product_count?: number;
  children: RawCategoryNode[];
}


const currencyOfMoney = (m: RawMoney): Currency => ({
  code: m.currency_code,
  symbol: m.currency_symbol || m.currency_code,
  decimal_places: m.currency_decimal_places ?? 2,
});

export function mapPublishedListItem(r: RawPublishedListItem): ProductListItem {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    thumbnail_url: r.thumbnail_url ?? "",
    mockup_url: r.mockup_url,
    retail_price: r.price?.amount ?? "0",
    currency: r.price ? currencyOfMoney(r.price) : { code: "", symbol: "", decimal_places: 2 },
    store: { name: r.owner?.display_name || "Creator", slug: String(r.owner?.id ?? "") },
    // The contract has no ratings or limited editions; zero values keep those badges hidden.
    rating: 0,
    review_count: 0,
    sold_quantity: r.sold_quantity ?? 0,
    is_limited_edition: false,
    // Only "sold out" is surfaced on cards; exact counts are a detail-page matter.
    available_quantity: r.in_stock === false ? 0 : null,
    created_at: r.published_at,
    kind: "published",
    allows_customization_on_top: r.allows_customization_on_top ?? false,
    blank_product_id: r.blank_product_id,
  };
}

export function mapBlankListItem(r: RawBlankListItem): ProductListItem {
  return {
    id: r.id,
    title: r.name,
    slug: r.slug,
    thumbnail_url: r.thumbnail_url ?? "",
    mockup_url: r.mockup_url,
    retail_price: "",
    currency: { code: r.currency_code, symbol: r.currency_code },
    store: { name: r.brand?.name ?? "Blank", slug: r.brand?.slug ?? "" },
    rating: 0,
    review_count: 0,
    sold_quantity: 0,
    is_limited_edition: false,
    created_at: r.created_at,
    kind: "blank",
    blank_product_id: r.id,
  };
}

export const pageOf = (items: ProductListItem[], count: number, next: string | null, page: number, pageSize: number): ProductListResponse => ({
  products: items,
  facets: { categories: [], brands: [], price_ranges: [], ratings: [] },
  sort_options: [],
  current_sort: "newest",
  total_results: count,
  page,
  total_pages: Math.max(1, Math.ceil(count / Math.max(1, pageSize))),
  has_next: !!next,
  has_previous: page > 1,
});

const bySort = <T extends { sort_order?: number }>(a: T, b: T) => (a.sort_order ?? 0) - (b.sort_order ?? 0);

/** Finds the orderable variant for a colour + size, whatever its availability. */
export function findVariant(p: Pick<ProductDetail, "variants">, colorId: string, sizeId: string): VariantInfo | undefined {
  return p.variants.find((v) => v.color_id === colorId && v.size_id === sizeId);
}

/** Mockups to show for a colour: its own photos, plus the colour-agnostic ones; every photo if the colour has none. */
export function mockupsForColor(mockups: MockupImage[], colorId: string | undefined): MockupImage[] {
  if (!colorId) return mockups;
  const own = mockups.filter((m) => m.color_id === colorId);
  if (own.length === 0) return mockups.filter((m) => m.color_id === null).length ? mockups.filter((m) => m.color_id === null) : mockups;
  return [...own, ...mockups.filter((m) => m.color_id === null)].sort((a, b) => a.sort_order - b.sort_order);
}

export function mapPublishedDetail(r: RawPublishedDetail): ProductDetail {
  const matrix = r.variant_matrix ?? { colors: [], sizes: [], combinations: [] };
  const sizeDefs = [...matrix.sizes].sort(bySort);

  const variants: VariantInfo[] = matrix.combinations.map((c) => ({
    variant_id: c.variant_id,
    sku: c.sku,
    color_id: c.color_id ?? c.options?.["color"] ?? "",
    size_id: c.size_id ?? c.options?.["size"] ?? "",
    available: c.available && (c.stock_quantity == null || c.stock_quantity > 0),
    stock_quantity: c.stock_quantity ?? null,
    price: c.price,
  }));

  let colors: ColorOption[] = [...matrix.colors].sort(bySort).map((col) => {
    const mine = variants.filter((v) => v.color_id === col.id);
    const sizes = sizeDefs
      .filter((s) => mine.some((v) => v.size_id === s.id))
      .map((s) => ({ id: s.id, label: s.label, available: !!mine.find((v) => v.size_id === s.id)?.available }));
    return { id: col.id, name: col.name, hex: col.hex || "#cccccc", available: sizes.some((s) => s.available), sizes };
  });

  // Open on the colour of the suggested variant (when it can be bought), else the first colour that can.
  const def = variants.find((v) => v.variant_id === r.design.default_variant_id && v.available);
  const first = colors.find((c) => c.id === def?.color_id) ?? colors.find((c) => c.available);
  if (first) colors = [first, ...colors.filter((c) => c !== first)];

  const prices = variants.filter((v) => v.available).map((v) => parseFloat(v.price)).filter((n) => !Number.isNaN(n));
  const currency: Currency = r.price ? currencyOfMoney(r.price) : { code: "", symbol: "", decimal_places: 2 };
  const fromPrice = prices.length ? Math.min(...prices).toFixed(currency.decimal_places ?? 2) : (r.price?.amount ?? "0");

  const mockups: MockupImage[] = [...(r.mockups ?? [])].sort((a, b) => a.display_order - b.display_order).map((m) => ({
    id: m.id,
    url: m.url,
    thumbnail_url: m.thumbnail_url || m.url,
    label: m.label,
    color_id: m.color_id ?? null,
    is_primary: m.is_primary,
    sort_order: m.display_order,
  }));
  const primaryUrl = mockups.find((m) => m.is_primary)?.url ?? mockups[0]?.url ?? r.mockup_url ?? "";

  const ownerId = String(r.owner?.id ?? "");
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    description: r.description,
    store: {
      id: ownerId,
      name: r.owner?.display_name || "Creator",
      slug: ownerId,
      ...(r.owner?.avatar_url ? { logo_url: r.owner.avatar_url } : {}),
      rating: 0,
      review_count: 0,
      product_count: 0,
      is_verified: false,
    },
    pricing: { retail_price: fromPrice, currency },
    colors,
    variants,
    default_variant_id: r.design.default_variant_id,
    mockups,
    thumbnail_url: r.mockup_url ?? primaryUrl,
    viewer3d: r.viewer_3d ? mapViewer3D(r.viewer_3d) : null,
    details: r.details ?? {},
    stats: { view_count: r.stats?.view_count ?? r.view_count ?? 0, sold_quantity: r.stats?.sold_quantity ?? r.sold_quantity ?? 0 },
    tags: r.tags ?? [],
    created_at: r.published_at,
    related_products: (r.related_products ?? []).filter((p) => p.is_active !== false).map(mapPublishedListItem),
    design_id: r.design.id,
    published_product_id: r.id,
    blank_slug: r.design.blank_product_slug,
    allows_customization_on_top: r.allows_customization_on_top ?? false,
  };
}

export function mapCategories(tree: RawCategoryNode[]): CategoryCard[] {
  return tree.map((n) => ({ id: n.id, name: n.name, slug: n.slug, product_count: n.product_count ?? 0 }));
}

export function flattenCategories(tree: RawCategoryNode[], out: CategoryCard[] = []): CategoryCard[] {
  for (const n of tree) {
    out.push({ id: n.id, name: n.name, slug: n.slug, product_count: n.product_count ?? 0 });
    flattenCategories(n.children ?? [], out);
  }
  return out;
}

/** The contract has no curated homepage; derive the sections from the newest published products. */
export function buildHomepage(items: ProductListItem[], categories: CategoryCard[]): Homepage {
  const trending = [...items].sort((a, b) => b.sold_quantity - a.sold_quantity).slice(0, 6);
  return {
    hero: [],
    trending: { title: "Trending", products: trending },
    new_arrivals: { title: "New arrivals", products: items.slice(0, 6) },
    top_stores: [],
    categories,
  };
}
