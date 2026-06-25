/**
 * src/features/designs/queries.ts
 */

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { storeProductApi } from "@/features/store/api";

export const designKeys = {
  all: ["user-designs"] as const,
  lists: () => [...designKeys.all, "list"] as const,
  list: (params?: Record<string, unknown>) =>
    [...designKeys.lists(), params] as const,
  details: () => [...designKeys.all, "detail"] as const,
  detail: (id: string) => [...designKeys.details(), id] as const,
};

export const designsQuery = (params?: {
  page?: number;
  page_size?: number;
  status?: string;
}) =>
  queryOptions({
    queryKey: designKeys.list(params),
    queryFn: () => storeProductApi.list(params),
    staleTime: 30_000,
  });

export const designsInfiniteQuery = (params?: {
  status?: string;
  page_size?: number;
}) =>
  infiniteQueryOptions({
    queryKey: [...designKeys.lists(), "infinite", params] as const,
    queryFn: ({ pageParam = 1 }) =>
      storeProductApi.list({
        ...params,
        page: pageParam as number,
        page_size: params?.page_size ?? 20,
      }),
    getNextPageParam: (last) =>
      last.pagination.has_next ? last.pagination.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 30_000,
  });

export const designDetailQuery = (id: string) =>
  queryOptions({
    queryKey: designKeys.detail(id),
    queryFn: () => storeProductApi.detail(id),
    staleTime: 60_000,
    enabled: !!id,
  });