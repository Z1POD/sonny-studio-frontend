// src/features/catalog/api.ts
//
// Blank catalog — the SAME endpoints the buyer app uses (shared contract):
//   GET /catalog/blank-products/      paginated blanks  (search, category [includes descendants], brand, page, page_size)
//   GET /catalog/categories/tree/     category tree
// Both are public (called without the token so a stale one can't break browsing).

import { api, type Page } from "@/shared/api/client";

/** Money object used across the contract. */
export interface RawMoney {
  amount: string;
  currency_code: string;
  currency_symbol: string;
  currency_decimal_places: number;
}

export interface RawBlankItem {
  id: string;
  name: string;
  slug: string;
  product_type: string;
  fit_style: string;
  brand?: { id: string; name: string; slug: string } | null;
  categories: { id: string; name: string; slug: string; path: string }[];
  mockup_url: string | null;
  thumbnail_url?: string | null;
  currency_code: string;
  is_active?: boolean;
  created_at: string;
  /** Lowest base (blank) price a creator pays per unit. */
  price?: RawMoney | null;
  /** `false` only when every variant is sold out. */
  in_stock?: boolean;
  /** Units across all variants, or null when stock isn't tracked. */
  available_quantity?: number | null;
  colors?: { name: string; hex: string }[];
  sizes?: string[];
  /** Suggested markup over cost, shown as a hint when pricing a design. */
  recommended_markup_percent?: string | null;
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

export interface CatalogBlank {
  id: string;
  slug: string;
  name: string;
  thumbnailUrl: string;
  brandName: string;
  categorySlugs: string[];
  price: { amount: string; symbol: string; decimalPlaces: number } | null;
  inStock: boolean;
  availableQuantity: number | null;
  colors: { name: string; hex: string }[];
  sizes: string[];
}

export function mapBlank(r: RawBlankItem): CatalogBlank {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    thumbnailUrl: r.thumbnail_url || r.mockup_url || "",
    brandName: r.brand?.name ?? "",
    categorySlugs: (r.categories ?? []).map((c) => c.slug),
    price: r.price
      ? { amount: r.price.amount, symbol: r.price.currency_symbol || r.price.currency_code, decimalPlaces: r.price.currency_decimal_places ?? 2 }
      : null,
    inStock: r.in_stock !== false,
    availableQuantity: r.available_quantity ?? null,
    colors: r.colors ?? [],
    sizes: r.sizes ?? [],
  };
}

export interface CategoryChip {
  slug: string;
  name: string;
}

const PUBLIC = { auth: false } as const;

export const catalogApi = {
  list: async (params: { search?: string; category?: string; page?: number; page_size?: number }) => {
    const page = params.page ?? 1;
    const res = await api.get<Page<RawBlankItem>>("/catalog/blank-products/", {
      ...PUBLIC,
      params: { search: params.search, category: params.category, page, page_size: params.page_size ?? 12 },
    });
    return {
      items: res.results.filter((r) => r.is_active !== false).map(mapBlank),
      count: res.count,
      page,
      hasNext: !!res.next,
    };
  },

  /** Top-level categories as filter chips (a parent's slug already includes its descendants server-side). */
  categories: async (): Promise<CategoryChip[]> => {
    const tree = await api.get<RawCategoryNode[]>("/catalog/categories/tree/", PUBLIC);
    return tree.map((n) => ({ slug: n.slug, name: n.name }));
  },
};
