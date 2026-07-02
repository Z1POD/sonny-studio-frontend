// src/features/studio/components/ProductModel.tsx

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import type { PrintArea, ArtworkState } from "../store";
import { useStudioStore } from "../store";
import { useWrapArtworkTexture } from "../hooks/useWrapArtworkTexture";
import { MeshNode } from "./product-model/MeshNode";

interface ProductModelProps {
  modelUrl: string;
  printAreas: PrintArea[];
  artworks: Record<string, ArtworkState>;
  layerOrder?: string[];
  selectedColor?: string | null;
  colorableMeshes?: string[];
  materialConfig?: {
    textureUrl: string | null;
    normalMapUrl: string | null;
    roughness: number;
    metalness: number;
  };
}

export function ProductModel({
  modelUrl,
  printAreas,
  artworks,
  layerOrder = [],
  selectedColor,
  colorableMeshes = [],
  materialConfig,
}: ProductModelProps) {
  const { nodes } = useGLTF(modelUrl);

  const selectedPrintAreaId = useStudioStore((s) => s.selectedPrintAreaId);
  const transformMode = useStudioStore((s) => s.transformMode);
  const setSelectedPrintArea = useStudioStore((s) => s.setSelectedPrintArea);
  const setArtwork = useStudioStore((s) => s.setArtwork);

  const meshNodes = useMemo(
    () =>
      Object.values(nodes).filter(
        (n): n is THREE.Mesh => n instanceof THREE.Mesh
      ),
    [nodes]
  );

  const wrapZone = useMemo(
    () =>
      printAreas.find(
        (z) => z.placement === "wrap" && !!artworks[z.id]?.decalUrl
      ),
    [printAreas, artworks]
  );
  const wrapArtwork = wrapZone ? artworks[wrapZone.id] : undefined;
  const wrapTexture = useWrapArtworkTexture(wrapArtwork);

  return (
    <group>
      {meshNodes.map((node) => (
        <MeshNode
          key={node.uuid}
          node={node}
          printAreas={printAreas}
          artworks={artworks}
          layerOrder={layerOrder}
          selectedPrintAreaId={selectedPrintAreaId}
          transformMode={transformMode}
          wrapTexture={wrapTexture}
          selectedColor={selectedColor}
          colorableMeshes={colorableMeshes}
          materialConfig={materialConfig}
          onSelectPrintArea={setSelectedPrintArea}
          onSetArtwork={setArtwork}
        />
      ))}
    </group>
  );
}