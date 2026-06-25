/**
 * src/features/orders/queries.ts
 */

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { ordersApi } from "./api";

export const orderKeys = {
  all: ["orders"] as const,
  lists: () => [...orderKeys.all, "list"] as const,
  list: (params?: Record<string, unknown>) =>
    [...orderKeys.lists(), params] as const,
  details: () => [...orderKeys.all, "detail"] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
};

export const ordersQuery = (params?: {
  page?: number;
  page_size?: number;
  status?: string;
  payment_status?: string;
}) =>
  queryOptions({
    queryKey: orderKeys.list(params),
    queryFn: () => ordersApi.list(params),
    staleTime: 30_000,
  });

export const ordersInfiniteQuery = (params?: {
  status?: string;
  payment_status?: string;
  page_size?: number;
}) =>
  infiniteQueryOptions({
    queryKey: [...orderKeys.lists(), "infinite", params] as const,
    queryFn: ({ pageParam = 1 }) =>
      ordersApi.list({ ...params, page: pageParam as number, page_size: params?.page_size ?? 20 }),
    getNextPageParam: (last) =>
      last.pagination.has_next ? last.pagination.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 30_000,
  });

export const orderDetailQuery = (id: string) =>
  queryOptions({
    queryKey: orderKeys.detail(id),
    queryFn: () => ordersApi.detail(id),
    staleTime: 30_000,
    enabled: !!id,
  });