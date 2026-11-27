/**
 * src/features/store/queries.ts
 */

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { storeProductApi } from "./api";
import { storeApi, type StatRange } from "./storeApi";
import { walletBalanceQuery } from "@/features/wallet/queries";

//     Keys                                                                      

export const storeProductKeys = {
  all: ["store-products"] as const,
  lists: () => [...storeProductKeys.all, "list"] as const,
  list: (params?: { page?: number; status?: string }) => [...storeProductKeys.lists(), params] as const,
  details: () => [...storeProductKeys.all, "detail"] as const,
  detail: (id: string) => [...storeProductKeys.details(), id] as const,
};

//     Queries                                                                   

export const storeProductsQuery = (params?: { page?: number; page_size?: number; status?: string }) =>
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

export const storeProductsInfiniteQuery = (pageSize = 20) =>
  infiniteQueryOptions({
    queryKey: [...storeProductKeys.lists(), "infinite", pageSize] as const,
    queryFn: ({ pageParam = 1 }) => storeProductApi.list({ page: pageParam as number, page_size: pageSize }),
    getNextPageParam: (last, all) => (last.next ? all.length + 1 : undefined),
    initialPageParam: 1,
    staleTime: 30_000,
  });

export const storeKeys = {
  profile: ["store-profile"] as const,
  dashboard: ["store-dashboard"] as const,
  earnings: (range: StatRange) => ["store-earnings", range] as const,
};

export const storeProfileQuery = () =>
  queryOptions({ queryKey: storeKeys.profile, queryFn: () => storeApi.profile(), staleTime: 120_000 });

/** One call for the whole landing screen (replaces the removed GET /store/stats/). */
export const storeDashboardQuery = () =>
  queryOptions({ queryKey: storeKeys.dashboard, queryFn: () => storeApi.dashboard(), staleTime: 60_000 });

export const storeEarningsQuery = (range: StatRange) =>
  queryOptions({ queryKey: storeKeys.earnings(range), queryFn: () => storeApi.earnings(range), staleTime: 60_000 });
