import { api } from "@/shared/api/client";
import type { Paginated } from "@/shared/api/types";

export type { CatalogBlank };

// Currency 
export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

// Pricing 

export interface CatalogPricing {
  currency: Currency;
  base_price: string;
  recommended_markup_percent: string;
}

// Brand 
export interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  city: string;
  website: string;
  is_active: boolean;
  status: string;
}

// Category

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon_url: string | null;
  parent: string | null;
  sort_order: number;
  is_active: boolean;
  children_count: number;
}

// Color 
export interface ColorInfo {
  name: string;
  hex: string;
}

// Available colors 

export interface AvailableColors {
  count: number;
  colors: ColorInfo[];
}

// Available sizes

export interface AvailableSizes {
  count: number;
  sizes: string[];
}

// Full CatalogBlank (aligned to real API)

export interface CatalogBlank {
  id: string;
  name: string;
  slug: string;
  fit: string;
  gender: string;
  thumbnail_url: string;
  pricing: CatalogPricing;
  brand: Brand;
  category: Category;
  is_featured: boolean;
  rating: string;
  review_count: number;
  available_colors: AvailableColors;
  available_sizes: AvailableSizes;
  tags: string[];
  created_at: string;
}

// API object 

export const catalogApi = {
  list: (params: Record<string, string | number> = {}) =>
    api.get<Paginated<CatalogBlank>>("/apparels/", { params }),

  categories: () =>
    api.get<{ success: boolean; data: Category[] }>("/apparels/categories/"),
};
