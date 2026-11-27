// src/features/studio/api.ts
//
// Studio endpoints (see STUDIO_API.md for request / response shapes):
//   GET  /studio/products/                 products the studio can open
//   GET  /studio/products/{slug}/config/   everything configurable for one product (+ ?from=<published slug>)
//   GET  /studio/artwork/                  stock artwork / stickers / shapes (paginated, filter by category)
//   POST /studio/designs/                  create a design from the studio state
//   PUT  /studio/designs/{id}/             re-save in the same session (no duplicates)
// Uploads reuse the signed-upload → register flow in shared/api/assets.ts.

import { api, type Page } from "@/shared/api/client";
import { deleteAsset, uploadAsset } from "@/shared/api/assets";
import {
  mapArtworkItem,
  mapSaveResponse,
  mapStudioConfig,
  type RawArtworkItem,
  type RawSaveDesignBody,
  type RawSaveDesignResponse,
  type RawStudioConfig,
} from "./contract";
import type { ArtworkItem, CaptureAngle, MockupCapture, ProductConfig, ProductSummary, SaveDesignResult } from "./types";

export interface RawStudioProductSummary {
  id: string;
  slug: string;
  name: string;
  available: boolean;
}

export const studioApi = {
  listProducts: async (): Promise<ProductSummary[]> => {
    const res = await api.get<Page<RawStudioProductSummary> | RawStudioProductSummary[]>("/studio/products/");
    const rows = Array.isArray(res) ? res : res.results;
    return rows.map((p) => ({ id: p.id, slug: p.slug, name: p.name, available: p.available }));
  },

  getConfig: async (slug: string, opts?: { from?: string; design?: string }): Promise<ProductConfig> => {
    const raw = await api.get<RawStudioConfig>(`/studio/products/${encodeURIComponent(slug)}/config/`, {
      params: { from: opts?.from, design: opts?.design },
    });
    return mapStudioConfig(raw);
  },

  listArtwork: async (params: { category: ArtworkItem["category"]; product?: string; page?: number; pageSize?: number }) => {
    const page = params.page ?? 1;
    const res = await api.get<Page<RawArtworkItem>>("/studio/artwork/", {
      params: { category: params.category, product: params.product, page, page_size: params.pageSize ?? 24 },
    });
    return { items: res.results.map(mapArtworkItem), page, hasNext: !!res.next };
  },

  /** Creates the design, or updates it when `designId` is given. */
  saveDesign: async (body: RawSaveDesignBody, designId?: string | null): Promise<SaveDesignResult> => {
    const res = designId
      ? await api.put<RawSaveDesignResponse>(`/studio/designs/${encodeURIComponent(designId)}/`, { body })
      : await api.post<RawSaveDesignResponse>("/studio/designs/", { body });
    return mapSaveResponse(res);
  },
};

/** Registers a buyer's file as a `creator_artwork` asset (the id is what a saved design references). */
export async function uploadArtworkFile(file: File) {
  const asset = await uploadAsset(file, "creator_artwork");
  return { assetId: asset.id, url: asset.secure_url };
}

/** Removes one of the caller's own uploads from their library (`409` while a design uses it). */
export const deleteOwnUpload = deleteAsset;

/** Uploads each captured angle as a `design_mockup` asset (in parallel). */
export async function uploadMockups(shots: MockupCapture[]): Promise<{ assetId: string; angle: CaptureAngle }[]> {
  return Promise.all(
    shots.map(async (s) => {
      const blob = await (await fetch(s.dataUrl)).blob();
      const asset = await uploadAsset(blob, "design_mockup");
      return { assetId: asset.id, angle: s.angle };
    }),
  );
}
