/**
 * src/features/wallet/queries.ts
 */

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { hasMorePages, walletApi } from "./api";

//     Keys                                                                      

export const walletKeys = {
  all: ["wallet"] as const,
  detail: () => [...walletKeys.all, "detail"] as const,
  balance: () => [...walletKeys.all, "balance"] as const,
  transactions: (params?: Record<string, unknown>) =>
    [...walletKeys.all, "transactions", params ?? {}] as const,
  paymentMethods: () => [...walletKeys.all, "payment-methods"] as const,
  myMethods: () => [...walletKeys.all, "my-methods"] as const,
  withdrawals: (params?: Record<string, unknown>) =>
    [...walletKeys.all, "withdrawals", params ?? {}] as const,
};

//     Queries                                                                   

export const walletDetailQuery = () =>
  queryOptions({
    queryKey: walletKeys.detail(),
    queryFn: () => walletApi.get(),
    staleTime: 30_000,
  });

export const walletBalanceQuery = () =>
  queryOptions({
    queryKey: walletKeys.balance(),
    queryFn: () => walletApi.balance(),
    staleTime: 15_000,
  });

export const walletTransactionsInfiniteQuery = (pageSize = 20) =>
  infiniteQueryOptions({
    queryKey: [...walletKeys.all, "transactions", "infinite", pageSize] as const,
    queryFn: ({ pageParam = 1 }) =>
      walletApi.transactions({ page: pageParam as number, page_size: pageSize }),
    getNextPageParam: (last, all) => (hasMorePages(last, all.reduce((n, p) => n + p.results.length, 0)) ? all.length + 1 : undefined),
    initialPageParam: 1,
    staleTime: 30_000,
  });

export const paymentMethodsQuery = () =>
  queryOptions({
    queryKey: walletKeys.paymentMethods(),
    queryFn: () => walletApi.paymentMethods(),
    staleTime: 300_000,
  });

export const myWithdrawalMethodsQuery = () =>
  queryOptions({
    queryKey: walletKeys.myMethods(),
    queryFn: () => walletApi.myMethods(),
    staleTime: 60_000,
  });

export const withdrawalsInfiniteQuery = (pageSize = 20) =>
  infiniteQueryOptions({
    queryKey: [...walletKeys.all, "withdrawals", "infinite", pageSize] as const,
    queryFn: ({ pageParam = 1 }) =>
      walletApi.withdrawals({ page: pageParam as number, page_size: pageSize }),
    getNextPageParam: (last, all) => (hasMorePages(last, all.reduce((n, p) => n + p.results.length, 0)) ? all.length + 1 : undefined),
    initialPageParam: 1,
    staleTime: 30_000,
  });
