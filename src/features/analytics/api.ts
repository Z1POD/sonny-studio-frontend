// src/features/analytics/api.ts

import { api } from "@/shared/api/client";

export type AnalyticsRange = "7d" | "30d" | "90d";

//    Core types                                                              

export interface RevenueSeries {
  date: string;       // "2025-06-01"
  earnings: number;
  orders: number;
}

export interface TopProduct {
  id: string;
  name: string;
  slug: string;
  thumbnail_url?: string;
  sales: number;
  earnings: number;
  currency_symbol: string;
}

export interface TrafficSource {
  label: string;      // "Telegram" | "Direct" | "Referral" | ...
  value: number;      // percentage 0-100
}

export interface OrderStatusBreakdown {
  status: string;
  count: number;
  percentage: number;
}

export interface RecentOrder {
  id: string;
  order_number: string;
  product_name: string;
  customer_name: string;
  amount: string;
  currency_symbol: string;
  status: string;
  created_at: string;
}

export interface AnalyticsSummary {
  range: AnalyticsRange;
  currency: {
    code: string;
    symbol: string;
  };
  // KPIs
  total_earnings: number;
  total_earnings_delta: number | null;   // % change vs previous period
  total_sales: number;
  total_sales_delta: number | null;
  total_orders: number;
  total_orders_delta: number | null;
  avg_earnings_per_order: number;
  avg_earnings_per_order_delta: number | null;
  conversion_rate: number;              // %
  conversion_rate_delta: number | null;
  total_views: number;
  total_views_delta: number | null;
  // Series
  series: RevenueSeries[];
  // Breakdowns
  top_products: TopProduct[];
  traffic_sources: TrafficSource[];
  order_status_breakdown: OrderStatusBreakdown[];
  recent_orders: RecentOrder[];
}

export const analyticsApi = {
  summary: async (range: AnalyticsRange): Promise<AnalyticsSummary> => {

    const res = await api.get<{ success: boolean; data: AnalyticsSummary }>(
      "/store/analytics/",
      { params: { range } }
    );
    
    return res?.data?.data ?? res?.data;
  }
}