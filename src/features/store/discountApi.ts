/**
 * src/features/store/discountApi.ts
 *
 * Discount & Coupon API — aligned to /api/v1/studio/ contract.
 */

import { api } from "@/shared/api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DiscountType = "percentage" | "fixed_amount" | "free_shipping";
export type DiscountScope = "item" | "order" | "shipping";

export interface DiscountRule {
  id: string;
  name: string;
  code: string;
  discount_type: DiscountType;
  discount_type_display: string;
  scope: DiscountScope;
  value: string;
  value_display: string;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  is_stackable: boolean;
  starts_at: string | null;
  ends_at: string | null;
  product_count: number;
  coupon_count: number;
  created_at: string;
}

export interface CreateDiscountRulePayload {
  name: string;
  discount_type: DiscountType;
  value: string;
  scope?: DiscountScope;
  max_uses?: number | null;
  max_uses_per_user?: number;
  starts_at?: string | null;
  ends_at?: string | null;
  is_stackable?: boolean;
  min_order_amount?: string;
  max_discount_amount?: string;
}

export interface Coupon {
  id: string;
  code: string;
  status: "active" | "used" | "disabled";
  status_display: string;
  is_single_use: boolean;
  used_at: string | null;
  used_on_order: string | null;
  created_at: string;
}

export interface GenerateCouponsPayload {
  count?: number;
  prefix?: string;
}

export interface ProductDiscount {
  id: string;
  discount_rule: {
    id: string;
    name: string;
    discount_type: DiscountType;
    value: string;
  };
  discount_code: string;
  discount_link: string;
  is_active: boolean;
  max_uses: number | null;
  current_uses: number;
  starts_at: string | null;
  ends_at: string | null;
  is_available: boolean;
  created_at: string;
}

export interface PublicLink {
  id: string;
  type: "direct" | "discount";
  url: string;
  label: string;
  discount_rule_id: string | null;
  discount_code?: string;
  created_at: string;
  is_active: boolean;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const discountApi = {
  // Discount Rules
  listRules: (): Promise<{ success: boolean; data: DiscountRule[] }> =>
    api.get("/store/discounts/"),

  createRule: (payload: CreateDiscountRulePayload): Promise<{ success: boolean; data: DiscountRule }> =>
    api.post("/store/discounts/", { body: payload }),

  updateRule: (
    id: string,
    payload: Partial<CreateDiscountRulePayload & { is_active: boolean }>,
  ): Promise<{ success: boolean; data: Partial<DiscountRule> }> =>
    api.put(`/store/discounts/${id}/`, { body: payload }),

  deleteRule: (id: string): Promise<void> =>
    api.delete(`/store/discounts/${id}/`),

  // Coupons
  listCoupons: (ruleId: string): Promise<{ success: boolean; data: Coupon[] }> =>
    api.get(`/store/discounts/${ruleId}/coupons/`),

  generateCoupons: (
    ruleId: string,
    payload: GenerateCouponsPayload,
  ): Promise<{ success: boolean; data: { rule_name: string; generated: number; coupons: Pick<Coupon, "id" | "code">[] } }> =>
    api.post(`/store/discounts/${ruleId}/coupons/generate/`, { body: payload }),

  revokeCoupon: (couponId: string): Promise<{ success: boolean; data: Pick<Coupon, "id" | "code" | "status"> }> =>
    api.post(`/store/coupons/${couponId}/revoke/`),

  // Product Discounts
  listProductDiscounts: (productId: string): Promise<{ success: boolean; data: ProductDiscount[] }> =>
    api.get(`/store/products/${productId}/discounts/`),

  applyDiscountToProduct: (
    productId: string,
    payload: { discount_rule_id: string; max_uses?: number; starts_at?: string; ends_at?: string },
  ): Promise<{ success: boolean; data: Pick<ProductDiscount, "id" | "discount_code" | "discount_link" | "created_at"> }> =>
    api.post(`/store/products/${productId}/discounts/`, { body: payload }),

  removeDiscountFromProduct: (discountId: string): Promise<void> =>
    api.delete(`/store/products/discounts/${discountId}/remove/`),

  // Public Links
  listLinks: (productId: string): Promise<{ success: boolean; data: PublicLink[] }> =>
    api.get(`/store/products/${productId}/links/`),

  createLink: (
    productId: string,
    payload: { type?: "direct" | "discount"; discount_rule_id?: string; label?: string },
  ): Promise<{ success: boolean; data: PublicLink }> =>
    api.post(`/store/products/${productId}/links/`, { body: payload }),

  deactivateLink: (productId: string, linkId: string): Promise<{ success: boolean; data: null }> =>
    api.post(`/store/products/${productId}/links/${linkId}/deactivate/`),
};