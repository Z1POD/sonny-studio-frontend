// src/features/studio/queries.ts

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { studioApi, artworkApi } from "./api";

/*     Studio product                                                          */

export const studioKeys = {
  all: ["studio"] as const,
  detail: (slugOrId: string) => [...studioKeys.all, "detail", slugOrId] as const,
};

export const studioDetailQuery = (slugOrId: string) =>
  queryOptions({
    queryKey: studioKeys.detail(slugOrId),
    queryFn: () => studioApi.get(slugOrId),
    staleTime: 60_000,
  });

/*     Artwork library                                                         */

export const artworkKeys = {
  all: ["artworks"] as const,
  library: () => [...artworkKeys.all, "library"] as const,
};

export const artworkLibraryInfiniteQuery = (pageSize = 20) =>
  infiniteQueryOptions({
    queryKey: [...artworkKeys.library(), "infinite", pageSize] as const,
    queryFn: ({ pageParam = 1 }) =>
      artworkApi.list({ page: pageParam as number, page_size: pageSize }),
    getNextPageParam: (last) =>
      last.pagination.has_next ? last.pagination.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 30_000,
  });