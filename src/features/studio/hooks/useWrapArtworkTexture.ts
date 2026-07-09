// src/features/studio/hooks/useWrapArtworkTexture.ts

import { useState, useEffect } from "react";
import { useThree } from "@react-three/fiber";
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
  const gl = useThree((s) => s.gl);

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
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.anisotropy = gl.capabilities.getMaxAnisotropy();
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
  }, [url, gl]);

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