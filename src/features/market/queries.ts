// src/features/market/queries.ts
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import { ApiError } from "@/shared/api/client";
import { marketApi } from "./api";
import type { ProductDetailParams } from "./api";
import type { ProductListParams } from "./types";

export const marketKeys = {
  all: ["market"] as const,
  homepage: () => [...marketKeys.all, "homepage"] as const,
  products: (params: Omit<ProductListParams, "page"> = {}) =>
    [...marketKeys.all, "products", params] as const,
  product: (slug: string, params: ProductDetailParams = {}) =>
    [...marketKeys.all, "product", slug, params] as const,
  blanks: (params: Omit<ProductListParams, "page"> = {}) =>
    [...marketKeys.all, "blanks", params] as const,
  categories: () => [...marketKeys.all, "categories"] as const,
  customizeSource: (slug: string) => [...marketKeys.all, "customize-source", slug] as const,
  store: (slug: string) => [...marketKeys.all, "store", slug] as const,
  category: (slug: string) => [...marketKeys.all, "category", slug] as const,
};

export const homepageQuery = () =>
  queryOptions({
    queryKey: marketKeys.homepage(),
    queryFn: () => marketApi.getHomepage(),
    staleTime: 60_000,
  });

/**
 * Powers the "load more" grid. `page` is supplied by react-query itself via
 * `pageParam` — never pass it in `params`.
 */
export const productsInfiniteQuery = (params: Omit<ProductListParams, "page"> = {}) =>
  infiniteQueryOptions({
    queryKey: marketKeys.products(params),
    queryFn: ({ pageParam }) => marketApi.listProducts({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.has_next ? lastPage.page + 1 : undefined),
    staleTime: 30_000,
  });

export const productQuery = (slug: string, params: ProductDetailParams = {}) => ({
  queryKey: marketKeys.product(slug, params),
  staleTime: 30_000,
  queryFn: async () => {
    try {
      return await marketApi.getProduct(slug, params);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.code === "not_found")) {
        throw notFound();
      }
      throw e;
    }
  },
});

export const blanksInfiniteQuery = (params: Omit<ProductListParams, "page"> = {}) =>
  infiniteQueryOptions({
    queryKey: marketKeys.blanks(params),
    queryFn: ({ pageParam }) => marketApi.listBlanks({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.has_next ? lastPage.page + 1 : undefined),
    staleTime: 30_000,
  });

export const categoriesQuery = () =>
  queryOptions({
    queryKey: marketKeys.categories(),
    queryFn: () => marketApi.getCategories(),
    staleTime: 10 * 60_000,
  });
