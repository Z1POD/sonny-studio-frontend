/**
 * src/features/store/discountQueries.ts
 */

import { queryOptions } from "@tanstack/react-query";
import { discountApi } from "./discountApi";

export const discountKeys = {
  all: ["discounts"] as const,
  rules: () => [...discountKeys.all, "rules"] as const,
  coupons: (ruleId: string) => [...discountKeys.all, "coupons", ruleId] as const,
  productDiscounts: (productId: string) => [...discountKeys.all, "product", productId] as const,
  links: (productId: string) => [...discountKeys.all, "links", productId] as const,
};

export const discountRulesQuery = () =>
  queryOptions({
    queryKey: discountKeys.rules(),
    queryFn: () => discountApi.listRules(),
    staleTime: 30_000,
  });

export const couponsQuery = (ruleId: string) =>
  queryOptions({
    queryKey: discountKeys.coupons(ruleId),
    queryFn: () => discountApi.listCoupons(ruleId),
    staleTime: 30_000,
    enabled: !!ruleId,
  });

export const productDiscountsQuery = (productId: string) =>
  queryOptions({
    queryKey: discountKeys.productDiscounts(productId),
    queryFn: () => discountApi.listProductDiscounts(productId),
    staleTime: 30_000,
    enabled: !!productId,
  });

export const productLinksQuery = (productId: string) =>
  queryOptions({
    queryKey: discountKeys.links(productId),
    queryFn: () => discountApi.listLinks(productId),
    staleTime: 30_000,
    enabled: !!productId,
  });