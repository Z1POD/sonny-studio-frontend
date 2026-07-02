// src/features/studio/hooks/useWrapArtworkTexture.ts

import { useState, useEffect } from "react";
import * as THREE from "three";
import type { ArtworkState } from "../store";
import {
  computeWrapTextureTransform,
  applyWrapTextureTransform,
} from "./useDecalTransforms";

const wrapTextureLoader = new THREE.TextureLoader();

export function useWrapArtworkTexture(
  artwork: ArtworkState | undefined
): THREE.Texture | null {
  const url = artwork?.decalUrl || null;
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!url) {
      setTexture(null);
      return;
    }

    let cancelled = false;
    let loaded: THREE.Texture | null = null;

    wrapTextureLoader.load(
      url,
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = false;
        loaded = tex;
        setTexture(tex);
      },
      undefined,
      (err) => {
        console.error("Failed to load wrap artwork texture:", url, err);
      }
    );

    return () => {
      cancelled = true;
      loaded?.dispose();
    };
  }, [url]);

  useEffect(() => {
    if (!texture || !artwork) return;
    applyWrapTextureTransform(texture, computeWrapTextureTransform(artwork));
  }, [
    texture,
    artwork?.decalScale,
    artwork?.decalAspect,
    artwork?.decalRotation,
    artwork?.decalOffsetX,
    artwork?.decalOffsetY,
  ]);

  return texture;
}