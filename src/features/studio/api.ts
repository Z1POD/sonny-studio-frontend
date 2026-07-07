// src/features/studio/api.ts

import { api } from "@/shared/api/client";
import type { StudioData } from "./store";

/*     Studio product                                                          */

export const studioApi = {
  get: async (slugOrId: string): Promise<StudioData> => {
    return api.get<StudioData>(`/apparels/${slugOrId}/editor-config/`);
  },
};

/*     Artwork                                                                 */

/**
 * Normalised shape used throughout the studio feature.
 */
export interface ArtworkItem {
  id: string;
  name: string;
  url: string;
  thumbnail_url: string;
  width: number;
  height: number;
  created_at: string;
}

/** Raw shape returned by POST /store/artworks/upload/ */
interface ArtworkUploadResponse {
  success: boolean;
  data: {
    id: string;
    name: string;
    file_url: string;
    metadata?: { width?: number; height?: number; thumbnail_url?: string };
    created_at: string;
  };
}

/** Raw shape returned by GET /store/artworks/ */
interface ArtworkListResponse {
  results: Array<{
    id: string;
    name: string;
    url?: string;
    file_url?: string;
    preview_url?: string;
    thumbnail_url?: string;
    width?: number;
    height?: number;
    metadata?: { width?: number; height?: number; thumbnail_url?: string };
    created_at: string;
  }>;
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

function normaliseArtwork(raw: ArtworkListResponse["results"][number]): ArtworkItem {
  const url = raw.file_url ?? raw.url ?? null;
  const width = raw.width ?? raw.metadata?.width ?? 1;
  const height = raw.height ?? raw.metadata?.height ?? 1;
  const thumbnail_url = raw.preview_url ?? raw.thumbnail_url ?? raw.metadata?.thumbnail_url ?? url;
  return { id: raw.id, name: raw.name, url, thumbnail_url, width, height, created_at: raw.created_at };
}

export const artworkApi = {
  list: async (params?: {
    page?: number;
    page_size?: number;
  }): Promise<{ items: ArtworkItem[]; pagination: ArtworkListResponse["pagination"] }> => {
    const res = await api.get<ArtworkListResponse>("/store/artworks/", {
      params: { page: params?.page ?? 1, page_size: params?.page_size ?? 20 },
    });
    return {
      items: (res.results ?? []).map(normaliseArtwork),
      pagination: res.pagination,
    };
  },

  upload: async (file: File): Promise<ArtworkItem> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", file.name);
    const res = await api.post<ArtworkUploadResponse>("/store/artworks/upload/", {
      body: formData,
    });
    const d = res.data;
    return {
      id: d.id,
      name: d.name,
      url: d.file_url,
      thumbnail_url: d.metadata?.thumbnail_url ?? d.file_url,
      width: d.metadata?.width ?? 1,
      height: d.metadata?.height ?? 1,
      created_at: d.created_at,
    };
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/store/artworks/${id}/`);
  },
};


