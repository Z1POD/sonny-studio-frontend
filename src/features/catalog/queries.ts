import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { catalogApi } from "./api";

export const catalogKeys = {
  all: ["catalog"] as const,
  list: (params: { search?: string; category?: string }) => [...catalogKeys.all, "list", params] as const,
  categories: () => [...catalogKeys.all, "categories"] as const,
};

/** Blanks, searched and filtered by the server and paged with "Load more". */
export const catalogListInfiniteQuery = (params: { search?: string; category?: string } = {}) =>
  infiniteQueryOptions({
    queryKey: catalogKeys.list(params),
    queryFn: ({ pageParam }) => catalogApi.list({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
    staleTime: 60_000,
  });

export const catalogCategoriesQuery = () =>
  queryOptions({
    queryKey: catalogKeys.categories(),
    queryFn: () => catalogApi.categories(),
    staleTime: 300_000, // categories rarely change
  });
