// src/features/studio/hooks/useStudioInit.ts
//
// Encapsulates all data-fetching and store-hydration concerns for StudioWorkspace.
// Returns the product + loading state so the workspace only has to render.

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useStudioStore } from "../store";
import { studioDetailQuery } from "../queries";
import { storeProductDetailQuery } from "@/features/store/queries";
import {
  mapEditorConfigToApparelProduct,
  mapSavedProductToApparelProduct,
  hydrateStudioFromSavedDesign,
} from "../studioMappers";

export interface StudioInitState {
  /** The apparel ID from router state (new design flow) */
  apparelId: string | null;
  /** The saved product ID from router state (edit / 3-D view flow) */
  savedProductId: string | null;
  /** True while any initial data is still loading */
  isLoading: boolean;
}

export function useStudioInit(): StudioInitState {
  const routerState   = useRouterState();
  const locationState = routerState.location.state as {
    apparelId?: string;
    productId?: string;
    mode?: "3d";
  } | undefined;

  const apparelId      = locationState?.apparelId      ?? null;
  const savedProductId = locationState?.productId      ?? null;
  const is3DMode       = locationState?.mode === "3d";

  const setProduct    = useStudioStore((s) => s.setProduct);
  const setAutoRotate = useStudioStore((s) => s.setAutoRotate);

  // ── Fetch editor config (new design from catalog) ─────────────────────────
  const { data: editorData, isLoading: editorLoading } = useQuery({
    ...studioDetailQuery(apparelId ?? ""),
    enabled: !!apparelId && !savedProductId,
  });

  // ── Fetch saved product detail (edit / 3-D view) ──────────────────────────
  const { data: savedDetail, isLoading: savedLoading } = useQuery({
    ...storeProductDetailQuery(savedProductId ?? ""),
    enabled: !!savedProductId,
  });

  // ── Hydrate: new design ───────────────────────────────────────────────────
  useEffect(() => {
    if (!editorData || savedProductId) return;
    const ap = mapEditorConfigToApparelProduct(editorData);
    setProduct(ap);
    if (is3DMode) setAutoRotate(true);
  }, [editorData, savedProductId, setProduct, is3DMode, setAutoRotate]);

  // ── Hydrate: saved design ─────────────────────────────────────────────────
  useEffect(() => {
    if (!savedDetail) return;
    const detail = (savedDetail as any).data ?? savedDetail;
    const ap = mapSavedProductToApparelProduct(detail);
    setProduct(ap);
    hydrateStudioFromSavedDesign(detail);
    if (is3DMode) setAutoRotate(true);
  }, [savedDetail, is3DMode, setProduct, setAutoRotate]);

  const isLoading = editorLoading || savedLoading;

  return { apparelId, savedProductId, isLoading };
}