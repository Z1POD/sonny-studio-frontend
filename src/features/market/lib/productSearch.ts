// src/features/market/lib/productSearch.ts
//
// Both /p/$slug and /product/$slug need to lift `code` (coupon),
// `ref`, and `utm_*` off the URL and forward them to the actual API
// request — the backend reads these directly off the product-detail
// request itself (see MarketplaceService.get_product_detail and
// TrafficService._determine_source), not from any separate endpoint.

import type { ProductDetailParams } from "../api";

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function parseProductSearch(search: Record<string, unknown>): ProductDetailParams {
  return {
    code: str(search.code),
    ref: str(search.ref),
    utm_source: str(search.utm_source),
    utm_medium: str(search.utm_medium),
    utm_campaign: str(search.utm_campaign),
  };
}