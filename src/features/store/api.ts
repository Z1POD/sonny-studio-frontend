/**
 * src/features/store/api.ts
 *
 * All store-product API calls, typed against the real backend contract.
 */

import { api } from "@/shared/api/client";

// ─── Shared shapes ────────────────────────────────────────────────────────────

export interface ProductCurrency {
  code: string;
  symbol: string;
  name: string;
}

export interface ProductPricing {
  base_price: string;
  markup_price: string;
  retail_price: string;
  currency: ProductCurrency | string;
}

export interface ProductMockup {
  id: string;
  type: string;
  url: string;
  is_primary: boolean;
  sort_order: number;
}

export interface ProductVariant {
  id: string;
  sku: string;
  color: { name: string; hex: string };
  size: string;
  in_stock?: boolean;
  isInStock?: boolean;
}

export interface ProductAnalytics {
  view_count: number;
  share_count: number;
}

// ─── List item (lightweight) ──────────────────────────────────────────────────

export interface ProductListItem {
  id: string;
  title: string;
  slug: string;
  thumbnail_url: string;
  pricing: ProductPricing;
  status: "draft" | "published" | "archived";
  is_published: boolean;
  sold_quantity: number;
  public_link: string;
  created_at: string;
}

/** Helper to extract retail price string from list item */
export function getRetailPrice(item: ProductListItem): string {
  if (!item.pricing) return "—";
  const p = item.pricing;
  const sym = typeof p.currency === "object" ? p.currency.symbol : "$";
  return `${sym}${p.retail_price}`;
}

export interface ProductListResponse {
  results: ProductListItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

// ─── Full detail ──────────────────────────────────────────────────────────────

export interface ProductDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail_url: string;
  mockups: ProductMockup[];
  base_apparel: { id: string; name: string; brand?: string; style?: string };
  pricing: ProductPricing;
  enabled_variant: ProductVariant[];
  snapshot: Record<string, unknown>;
  render_config: Record<string, unknown>;
  is_published: boolean;
  is_limited_edition: boolean;
  production_ready?: boolean;
  max_quantity: number | null;
  sold_quantity: number;
  public_link: string;
  analytics?: ProductAnalytics;
  status?: string;
  created_at: string;
  updated_at: string;
}

interface DetailApiResponse {
  success: boolean;
  data: ProductDetail;
}

// ─── Create payload ───────────────────────────────────────────────────────────

export interface PrintAreaPayload {
  print_area_id: string;
  print_method_id: string;
  width_cm: string;
  height_cm: string;
  color_count: number;
  artwork_id?: string;
  design_data: {
    layers: Array<{
      type: "image" | "text";
      url?: string;
      position?: { x: number; y: number };
      scale?: number;
      rotation?: number;
      content?: string;
      font?: string;
      size?: number;
    }>;
  };
}

export interface CreateProductPayload {
  title: string;
  description?: string;
  base_apparel: string;
  markup_price: string;
  print_areas: PrintAreaPayload[];
  snapshot: Record<string, unknown>;
  render_config: Record<string, unknown>;
  enabled_variants: string[];
  is_limited_edition: boolean;
  production_ready?: boolean;
  max_quantity?: number | null;
}

// ─── Update payload ───────────────────────────────────────────────────────────

export interface UpdateProductPayload {
  title?: string;
  description?: string;
  markup_price?: string;
  enabled_variants?: string[];
  print_areas?: Partial<PrintAreaPayload>[];
  is_limited_edition?: boolean;
  production_ready?: boolean;
  max_quantity?: number | null;
}

// ─── Assets upload response ───────────────────────────────────────────────────

export interface AssetsUploadResponse {
  success: boolean;
  data: {
    id: string;
    thumbnail_url: string;
    mockups: ProductMockup[];
    assets_count: number;
  };
}

// ─── API object ───────────────────────────────────────────────────────────────

export const storeProductApi = {
  list: async (params?: {
    page?: number;
    page_size?: number;
    status?: string;
  }): Promise<ProductListResponse> => {
    return api.get<ProductListResponse>("/store/products/", {
      params: {
        page: params?.page ?? 1,
        page_size: params?.page_size ?? 20,
        ...(params?.status ? { status: params.status } : {}),
      },
    });
  },

  detail: async (id: string): Promise<ProductDetail> => {
    const res = await api.get<DetailApiResponse>(`/store/products/${id}/`);
    return res.data;
  },

  create: async (
    payload: CreateProductPayload,
  ): Promise<ProductDetail> => {
    const res = await api.post<DetailApiResponse>("/store/products/create/", {
      body: payload,
    });
    return res.data;
  },

  update: async (
    id: string,
    payload: UpdateProductPayload,
  ): Promise<ProductDetail> => {
    const res = await api.patch<DetailApiResponse>(`/store/products/${id}/`, {
      body: payload,
    });
    return res.data;
  },


  publish: async (id: string) => {
    const res = await api.post<{ success: boolean; data: { id: string; status: string; is_published: boolean; public_link: string } }>(`/store/products/${id}/publish/`);
    return res.data;
  },

  archive: async (id: string): Promise<void> => {
    await api.post(`/store/products/${id}/archive/`);
  },

  deleteProduct: async (id: string): Promise<void> => {
    await api.delete(`/store/products/${id}/delete/`);
  },

  /** Upload mockup images (multipart). Returns updated mockup list. */
  uploadAssets: async (
    productId: string,
    blobs: Array<{ blob: Blob; type: string; name: string }>,
  ): Promise<AssetsUploadResponse["data"]> => {
    const fd = new FormData();
    blobs.forEach(({ blob, name, type }, i) => {
      fd.append("files", new File([blob], name, { type: "image/png" }));
      fd.append("mockup_types", type);
    });
    const res = await api.post<AssetsUploadResponse>(
      `/store/products/${productId}/assets/`,
      { body: fd },
    );
    return res.data;
  },
};