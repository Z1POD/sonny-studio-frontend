// src/features/analytics/api.ts
//   GET /store/analytics/?range=7d|30d|90d — trends and attribution only. The order list and the status breakdown
//   were removed (order management belongs to the orders app).

import { api } from "@/shared/api/client";
import type { Currency } from "@/shared/api/types";
import type { SeriesPoint, TopProduct } from "@/features/store/storeApi";

export type AnalyticsRange = "7d" | "30d" | "90d";

export interface AnalyticsSummary {
  range: AnalyticsRange;
  currency: Currency;
  totals: {
    earnings: string;
    earnings_delta: number | null;
    orders: number;
    orders_delta: number | null;
    items_sold: number;
    items_sold_delta: number | null;
    views: number;
    views_delta: number | null;
    /** orders / views × 100 (1 decimal); null when the period had no views. */
    conversion_rate: number | null;
    conversion_rate_delta: number | null;
    avg_earnings_per_order: string;
    avg_earnings_per_order_delta: number | null;
  };
  lifetime: { earnings: string; orders: number; items_sold: number };
  /** Zero-filled for the whole range; carries views too. */
  series: SeriesPoint[];
  top_products: TopProduct[];
  /** Top 5 utm_source values of the period's product views. */
  traffic_sources: { label: string; value: number }[];
}

export const analyticsApi = {
  summary: (range: AnalyticsRange) => api.get<AnalyticsSummary>("/store/analytics/", { params: { range } }),
};
