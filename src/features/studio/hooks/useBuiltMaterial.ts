// src/features/studio/hooks/useBuiltMaterial.ts

import { useMemo, useEffect } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

interface UseBuiltMaterialProps {
  node: THREE.Mesh;
  selectedColor?: string | null;
  colorableMeshes: string[];
  materialConfig?: {
    textureUrl: string | null;
    normalMapUrl: string | null;
    roughness: number;
    metalness: number;
  };
}

export function useBuiltMaterial({
  node,
  selectedColor,
  colorableMeshes,
  materialConfig,
}: UseBuiltMaterialProps): THREE.Material {
  const diffuse = materialConfig?.textureUrl
    ? useTexture(materialConfig.textureUrl)
    : null;
  const normal = materialConfig?.normalMapUrl
    ? useTexture(materialConfig.normalMapUrl)
    : null;

  const material = useMemo(() => {
    const isColorable =
      colorableMeshes.length === 0 ||
      colorableMeshes.some((n) =>
        node.name.toLowerCase().includes(n.toLowerCase())
      );

    const hasTexture = !!materialConfig?.textureUrl;
    const hasNormal = !!materialConfig?.normalMapUrl;
    const hasColor = isColorable && !!selectedColor;

    if (!hasColor && !hasTexture && !hasNormal) {
      return node.material as THREE.Material;
    }

    if (hasTexture && diffuse) diffuse.colorSpace = THREE.SRGBColorSpace;

    return new THREE.MeshStandardMaterial({
      color: hasColor ? new THREE.Color(selectedColor!) : undefined,
      map: hasTexture ? diffuse : null,
      normalMap: hasNormal ? normal : null,
      roughness: materialConfig?.roughness ?? 0.9,
      metalness: materialConfig?.metalness ?? 0,
      side: THREE.DoubleSide,
    });
  }, [node, selectedColor, colorableMeshes, materialConfig, diffuse, normal]);

  const isOwned = material !== node.material;
  useEffect(() => {
    return () => {
      if (isOwned) material.dispose();
    };
  }, [material, isOwned]);

  return material;
}