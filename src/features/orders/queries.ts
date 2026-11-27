/**
 * src/features/orders/queries.ts
 */

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { ordersApi, SETTLING } from "./api";

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

/**
 * After a payment is verified the order moves paid_verifying → sent_to_printer on its own, so poll
 * every 5s for up to 30s from when the sheet was opened (no websockets in this version).
 */
export const orderDetailQuery = (id: string, openedAt: number = Date.now()) =>
  queryOptions({
    queryKey: orderKeys.detail(id),
    queryFn: () => ordersApi.detail(id),
    staleTime: 30_000,
    enabled: !!id,
    refetchInterval: (q) => {
      const st = q.state.data?.status;
      return st && SETTLING.includes(st) && Date.now() - openedAt < 30_000 ? 5_000 : false;
    },
  });