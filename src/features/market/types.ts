// src/features/market/types.ts
//
// Lightweight types for the public product-browsing side of the marketplace
// (homepage, listing/search, store & category pages).
//
// Full single-product types (`ProductDetail`, `ColorVariant`, `CartItem`,
// etc.) live in `./api.ts` next to the API calls that return them, so this
// feature stays self-contained with no dependency on an external types
// module.

export interface Currency {
  code: string;
  symbol: string;
  name?: string;
}

export interface ProductListItem {
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

export interface HomepageCollection {
  id: string;
  name: string;
  slug: string;
  description?: string;
  banner_url?: string;
  mobile_banner_url?: string;
  product_count: number;
  products: ProductListItem[];
}

export interface HomepageSection {
  title: string;
  products: ProductListItem[];
}

export interface StoreCard {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  banner_url?: string;
  rating: number;
  review_count: number;
  product_count: number;
}

export interface CategoryCard {
  id: string;
  name: string;
  slug: string;
  product_count: number;
}

export interface Homepage {
  hero: HomepageCollection[];
  trending: HomepageSection;
  new_arrivals: HomepageSection;
  top_stores: StoreCard[];
  categories: CategoryCard[];
}

export interface ProductListParams {
  q?: string;
  category?: string;
  brand?: string;
  store?: string;
  min_price?: number;
  max_price?: number;
  size?: string;
  color?: string;
  fit?: string;
  gender?: string;
  min_rating?: number;
  sort?: "popular" | "newest" | "price_low" | "price_high" | "rating";
  page?: number;
  page_size?: number;
}

export interface Facet {
  slug?: string;
  range?: string;
  rating?: number;
  name?: string;
  label: string;
  count: number;
}

export interface ProductListResponse {
  products: ProductListItem[];
  facets: {
    categories: Facet[];
    brands: Facet[];
    price_ranges: Facet[];
    ratings: Facet[];
  };
  sort_options: { value: string; label: string }[];
  current_sort: string;
  total_results: number;
  page: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface StoreDetail {
  store: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    logo_url?: string;
    banner_url?: string;
    rating: number;
    review_count: number;
    product_count: number;
    is_verified: boolean;
  };
  products: ProductListItem[];
  total_products: number;
}

export interface CategoryDetail {
  category: CategoryCard & { description?: string };
  products: ProductListItem[];
}

export interface WishlistToggleResult {
  is_in_wishlist: boolean;
  wishlist_count: number;
}