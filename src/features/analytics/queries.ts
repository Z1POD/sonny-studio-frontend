// src/features/analytics/queries.ts

import { queryOptions } from "@tanstack/react-query";
import { analyticsApi, type AnalyticsRange } from "./api";

export const analyticsKeys = {
  all: ["analytics"] as const,
  summary: (range: AnalyticsRange) =>
    [...analyticsKeys.all, "summary", range] as const,
};

export const analyticsSummaryQuery = (range: AnalyticsRange) =>
  queryOptions({
    queryKey: analyticsKeys.summary(range),
    queryFn: () => analyticsApi.summary(range),
    staleTime: 60_000,
  });