// src/features/store/storeApi.ts — Store API (api/v1/store/…): profile, dashboard, earnings.
// Money is always a decimal string; `*_delta` is a % vs the previous equal period, null when that had no activity
// (render "—", never 0). `GET /store/stats/` no longer exists — the dashboard endpoint replaces it.

import { api } from "@/shared/api/client";
import type { Currency } from "@/shared/api/types";

export type StatRange = "7d" | "30d" | "90d";

//     Profile (GET/PATCH /store/)

export interface StoreSocialLinks {
  instagram_url?: string;
  tiktok_url?: string;
  telegram_url?: string;
  website_url?: string;
}

export interface StoreProfile {
  name: string;
  description: string;
  logo_url: string | null;
  banner_url: string | null;
  contact_phone: string;
  social_links: StoreSocialLinks;
  /** Staff-managed; PATCH ignores it. */
  is_verified: boolean;
  verified_at: string | null;
  is_accepting_orders: boolean;
  owner: { id: string; username: string; display_name: string; avatar_url: string | null };
  created_at: string;
  updated_at: string;
}

/** Every field optional — only sent keys change. Empty string clears a social link. */
export interface UpdateStoreProfilePayload {
  name?: string;
  description?: string;
  /** `null` removes the current image. */
  logo_asset_id?: string | null;
  banner_asset_id?: string | null;
  contact_phone?: string;
  social_links?: StoreSocialLinks;
  is_accepting_orders?: boolean;
}

//     Shared blocks

export interface SeriesPoint {
  date: string;
  earnings: string;
  orders: number;
  views?: number;
}

export interface TopProduct {
  id: string;
  title: string;
  slug: string;
  thumbnail_url: string | null;
  sales: number;
  earnings: string;
  currency_symbol: string;
}

export interface StoreBalances {
  available: string;
  pending: string;
  total_earned: string;
  total_withdrawn: string;
}

//     Dashboard (GET /store/dashboard/)

export interface StoreDashboard {
  store: { name: string; logo_url: string | null; banner_url: string | null; is_verified: boolean; is_accepting_orders: boolean };
  currency: Currency;
  earnings: { today: string; week: string; week_delta: number | null; month: string; month_delta: number | null; lifetime: string };
  sales: {
    orders_week: number;
    orders_month: number;
    items_sold_week: number;
    items_sold_month: number;
    lifetime_orders: number;
    lifetime_items_sold: number;
  };
  products: { total: number; published: number; draft: number; archived: number };
  visibility: { views_month: number; conversion_rate: number | null };
  balances: StoreBalances;
  needs_attention: { pending_orders: number; open_disputes: number };
  promotions: { active_discounts: number; available_coupons: number };
  top_products: TopProduct[];
  /** Always 14 entries, zero-filled. */
  mini_series: SeriesPoint[];
  generated_at: string;
}

//     Earnings (GET /store/earnings/?range=)

export interface StoreEarnings {
  range: StatRange;
  currency: Currency;
  balances: StoreBalances;
  /** The commission the platform took from this creator's earnings. */
  platform_fees_paid: string;
  payout: {
    min_withdrawal: string | null;
    max_withdrawal: string | null;
    can_withdraw: boolean;
    next_estimated_release_amount: string | null;
    next_estimated_release_at: string | null;
  };
  period: {
    earnings: string;
    earnings_delta: number | null;
    orders: number;
    orders_delta: number | null;
    items_sold: number;
    items_sold_delta: number | null;
    avg_earnings_per_order: string;
    avg_earnings_per_order_delta: number | null;
  };
  series: SeriesPoint[];
  /** Up to 10 escrow holds already split to the creator's pending accounts, oldest clearance first. */
  pending_releases: {
    order_id: string;
    order_number: string;
    amount: string;
    currency_symbol: string;
    released_at: string;
    expected_available_at: string;
  }[];
  lifetime: { earnings: string; orders: number; items_sold: number; withdrawn: string; platform_fees_paid: string };
}

export const storeApi = {
  profile: () => api.get<StoreProfile>("/store/"),
  updateProfile: (payload: UpdateStoreProfilePayload) => api.patch<StoreProfile>("/store/", { body: payload }),
  dashboard: () => api.get<StoreDashboard>("/store/dashboard/"),
  earnings: (range: StatRange) => api.get<StoreEarnings>("/store/earnings/", { params: { range } }),
};
