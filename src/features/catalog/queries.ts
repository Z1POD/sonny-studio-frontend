import { queryOptions } from "@tanstack/react-query";
import { catalogApi } from "./api";

export const catalogKeys = {
  all: ["catalog"] as const,
  list: (params: Record<string, unknown> = {}) =>
    [...catalogKeys.all, "list", params] as const,
  categories: () => [...catalogKeys.all, "categories"] as const,
};

export const catalogListQuery = (
  params: Record<string, string | number> = {},
) =>
  queryOptions({
    queryKey: catalogKeys.list(params),
    queryFn: () => catalogApi.list(params),
    staleTime: 60_000,
  });

export const catalogCategoriesQuery = () =>
  queryOptions({
    queryKey: catalogKeys.categories(),
    queryFn: () => catalogApi.categories(),
    staleTime: 300_000, // categories rarely change
  });
