import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { accountApi } from "./api";

export const accountKeys = {
  addresses: ["account", "addresses"] as const,
  currencies: ["account", "currencies"] as const,
  prefs: ["account", "notification-prefs"] as const,
  notifications: (p: Record<string, unknown>) => ["account", "notifications", p] as const,
};

export const addressesQuery = () => queryOptions({ queryKey: accountKeys.addresses, queryFn: accountApi.addresses });
export const currenciesQuery = () =>
  queryOptions({ queryKey: accountKeys.currencies, queryFn: accountApi.currencies, staleTime: 60 * 60_000 });
export const prefsQuery = () => queryOptions({ queryKey: accountKeys.prefs, queryFn: accountApi.prefs });

export const notificationsInfiniteQuery = (params: { channel?: string; status?: string } = {}) =>
  infiniteQueryOptions({
    queryKey: accountKeys.notifications(params),
    queryFn: ({ pageParam }) => accountApi.notifications({ ...params, page: pageParam, page_size: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.next ? all.length + 1 : undefined),
    staleTime: 15_000,
  });
