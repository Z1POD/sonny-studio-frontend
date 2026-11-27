/**
 * src/features/store/discountApi.ts
 *
 * Discount & Coupon API — aligned to the shared contract (bare JSON, readable errors).
 */

import { api } from "@/shared/api/client";

//     Types                                                                     

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
  max_uses_per_user?: number | null;
  current_uses: number;
  new_customers_only?: boolean;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  product_count: number;
  coupon_count: number;
  /** Same number as `current_uses`, kept for readability next to product_count / coupon_count. */
  redemption_count?: number;
  created_at: string;
}

export interface CreateDiscountRulePayload {
  name: string;
  discount_type: DiscountType;
  value: string;
  scope?: DiscountScope;
  max_uses?: number | null;
  max_uses_per_user?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  min_order_amount?: string;
  max_discount_amount?: string;
  new_customers_only?: boolean;
}

export interface Redemption {
  id: string;
  order_id: string;
  order_number: string;
  order_status: string;
  buyer_username: string;
  /** coupon (a generated code) or product_link (the rule's own code from a product link). */
  source: "coupon" | "product_link";
  coupon_code: string | null;
  product_title: string | null;
  amount: string;
  created_at: string;
}

export interface RedemptionPage {
  count: number;
  page: number;
  page_size: number;
  results: Redemption[];
}

export interface Coupon {
  id: string;
  code: string;
  status: "active" | "used" | "revoked";
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

//     API                                                                       

export const discountApi = {
  // Discount Rules
  listRules: (): Promise<DiscountRule[]> =>
    api.get("/store/discounts/"),

  createRule: (payload: CreateDiscountRulePayload): Promise<DiscountRule> =>
    api.post("/store/discounts/", { body: payload }),

  updateRule: (
    id: string,
    payload: Partial<Omit<CreateDiscountRulePayload, "discount_type">> & { is_active?: boolean },
  ): Promise<DiscountRule> =>
    api.patch(`/store/discounts/${id}/`, { body: payload }),

  deleteRule: (id: string): Promise<void> =>
    api.delete(`/store/discounts/${id}/`),

  /** Who used the rule, on which order, for how much (owner-only, paginated). */
  redemptions: (ruleId: string, params?: { page?: number; page_size?: number }): Promise<RedemptionPage> =>
    api.get(`/store/discounts/${ruleId}/redemptions/`, { params }),

  // Coupons
  listCoupons: (ruleId: string): Promise<Coupon[]> =>
    api.get(`/store/discounts/${ruleId}/coupons/`),

  generateCoupons: (
    ruleId: string,
    payload: GenerateCouponsPayload,
  ): Promise<{ rule_name: string; generated: number; coupons: Pick<Coupon, "id" | "code">[] }> =>
    api.post(`/store/discounts/${ruleId}/coupons/generate/`, { body: payload }),

  revokeCoupon: (couponId: string): Promise<Pick<Coupon, "id" | "code" | "status">> =>
    api.post(`/store/coupons/${couponId}/revoke/`),

  // Product Discounts
  listProductDiscounts: (productId: string): Promise<ProductDiscount[]> =>
    api.get(`/store/products/${productId}/discounts/`),

  applyDiscountToProduct: (
    productId: string,
    payload: { discount_rule_id: string; max_uses?: number; starts_at?: string; ends_at?: string },
  ): Promise<Pick<ProductDiscount, "id" | "discount_code" | "discount_link" | "created_at">> =>
    api.post(`/store/products/${productId}/discounts/`, { body: payload }),

  /** Takes a rule off a product (idempotent; 204). */
  removeDiscountFromProduct: (productId: string, ruleId: string): Promise<void> =>
    api.delete(`/store/products/${productId}/discounts/${ruleId}/`),

  // Public Links
  listLinks: (productId: string): Promise<PublicLink[]> =>
    api.get(`/store/products/${productId}/links/`),

  createLink: (
    productId: string,
    payload: { type?: "direct" | "discount"; discount_rule_id?: string; label?: string },
  ): Promise<PublicLink> =>
    api.post(`/store/products/${productId}/links/`, { body: payload }),

  deactivateLink: (productId: string, linkId: string): Promise<null> =>
    api.post(`/store/products/${productId}/links/${linkId}/deactivate/`),
};