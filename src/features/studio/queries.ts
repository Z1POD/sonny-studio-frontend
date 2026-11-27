// src/features/studio/queries.ts

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { studioApi } from "./api";
import type { ArtworkItem } from "./types";

export const studioKeys = {
  all: ["studio"] as const,
  config: (slug: string, from?: string, design?: string) => [...studioKeys.all, "config", slug, from ?? null, design ?? null] as const,
  artwork: (category: ArtworkItem["category"], product?: string) => [...studioKeys.all, "artwork", category, product ?? null] as const,
};

export const studioConfigQuery = (slug: string, from?: string, design?: string) =>
  queryOptions({
    queryKey: studioKeys.config(slug, from, design),
    queryFn: () => studioApi.getConfig(slug, { from, design }),
    // The config is user-specific (plan, stock) and seeds local editing state — never refetch behind the editor.
    staleTime: Infinity,
    gcTime: 0,
    retry: 1,
  });

/** Always pass the product so the server composes the list from its artwork policy (tied first). */
export const studioArtworkQuery = (category: ArtworkItem["category"], product?: string, enabled = true) =>
  infiniteQueryOptions({
    queryKey: studioKeys.artwork(category, product),
    queryFn: ({ pageParam }) => studioApi.listArtwork({ category, product, page: pageParam }),
    enabled,
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
    staleTime: 5 * 60_000,
  });
