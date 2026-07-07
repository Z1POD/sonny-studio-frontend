/**
 * src/features/store/queries.ts
 * Updated to use wallet API for balance data
 */

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { storeProductApi } from "./api";
import { walletApi } from "@/features/wallet/api";

//     Keys                                                                      

export const storeProductKeys = {
  all: ["store-products"] as const,
  lists: () => [...storeProductKeys.all, "list"] as const,
  list: (params?: { page?: number; status?: string }) =>
    [...storeProductKeys.lists(), params] as const,
  details: () => [...storeProductKeys.all, "detail"] as const,
  detail: (id: string) => [...storeProductKeys.details(), id] as const,
};

//     Queries                                                                   

export const storeProductsQuery = (params?: {
  page?: number;
  page_size?: number;
  status?: string;
}) =>
  queryOptions({
    queryKey: storeProductKeys.list(params),
    queryFn: () => storeProductApi.list(params),
    staleTime: 30_000,
  });

export const storeProductDetailQuery = (id: string) =>
  queryOptions({
    queryKey: storeProductKeys.detail(id),
    queryFn: () => storeProductApi.detail(id),
    staleTime: 60_000,
    enabled: !!id,
  });

//     Infinite / paginated                                                      

export const storeProductsInfiniteQuery = (pageSize = 20) =>
  infiniteQueryOptions({
    queryKey: [...storeProductKeys.lists(), "infinite", pageSize] as const,
    queryFn: ({ pageParam = 1 }) =>
      storeProductApi.list({ page: pageParam as number, page_size: pageSize }),
    getNextPageParam: (last) =>
      last.pagination.has_next ? last.pagination.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 30_000,
  });

export const storeStatsQuery = () =>
  queryOptions({
    queryKey: ["store-stats"],
    queryFn: () =>
      import("@/shared/api/client").then(({ api }) =>
        api.get<{
          total_products: number;
          total_sales: number;
          total_revenue: number;
          rating: number | null;
        }>("/store/stats/"),
      ),
    staleTime: 60_000,
  });

//     Wallet (uses new wallet API)                                              

export const walletQuery = () =>
  queryOptions({
    queryKey: ["wallet-balance-lite"],
    queryFn: () => walletApi.balance(),
    staleTime: 60_000,
  });

export const storeSummaryQuery = () =>
  queryOptions({
    queryKey: ["store-summary"],
    queryFn: () =>
      import("@/shared/api/client").then(({ api }) =>
        api.get<{
          data: {
            name: string;
            description: string;
            logo_url?: string;
          };
        }>("/store/"),
      ),
    staleTime: 120_000,
  });
