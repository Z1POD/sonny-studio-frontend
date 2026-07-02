// src/features/studio/components/product-model/MeshNode.tsx

import * as THREE from "three";
import type { ArtworkState, PrintArea, TransformMode } from "../../store";
import { useBuiltMaterial } from "../../hooks/useBuiltMaterial";
import { DecalLayer } from "./Decals";
import { WrapOverlayMesh } from "./WrapOverlayMesh";

interface MeshNodeProps {
  node: THREE.Mesh;
  printAreas: PrintArea[];
  artworks: Record<string, ArtworkState>;
  layerOrder: string[];
  selectedPrintAreaId: string | null;
  transformMode: TransformMode;
  wrapTexture: THREE.Texture | null;
  selectedColor?: string | null;
  colorableMeshes: string[];
  materialConfig?: {
    textureUrl: string | null;
    normalMapUrl: string | null;
    roughness: number;
    metalness: number;
  };
  onSelectPrintArea: (id: string | null) => void;
  onSetArtwork: (zoneId: string, patch: Partial<ArtworkState>) => void;
}

function zoneTargetsMesh(zone: PrintArea, meshName: string): boolean {
  if (!zone.meshName) return true;
  return meshName.toLowerCase().includes(zone.meshName.toLowerCase());
}

export function MeshNode({
  node,
  printAreas,
  artworks,
  layerOrder,
  selectedPrintAreaId,
  transformMode,
  wrapTexture,
  selectedColor,
  colorableMeshes,
  materialConfig,
  onSelectPrintArea,
  onSetArtwork,
}: MeshNodeProps) {
  const material = useBuiltMaterial({
    node,
    selectedColor,
    colorableMeshes,
    materialConfig,
  });

  const zonesForMesh = printAreas
    .filter((z) => z.placement !== "wrap" && zoneTargetsMesh(z, node.name))
    .sort((a, b) => {
      const ai = layerOrder.indexOf(a.id);
      const bi = layerOrder.indexOf(b.id);
      return (ai === -1 ? -Infinity : ai) - (bi === -1 ? -Infinity : bi);
    });

  return (
    <group key={node.uuid}>
      <mesh
        castShadow
        receiveShadow
        geometry={node.geometry}
        material={material}
        onClick={(e: any) => {
          e.stopPropagation();
          onSelectPrintArea(null);
        }}
      >
        {zonesForMesh.map((zone, stackIndex) => {
          const art = artworks[zone.id];
          if (!art?.decalUrl) return null;
          return (
            <DecalLayer
              key={zone.id}
              artwork={art}
              zone={zone}
              meshNode={node}
              stackIndex={stackIndex}
              isActive={zone.id === selectedPrintAreaId}
              transformMode={transformMode}
              onSelect={onSelectPrintArea}
              onTransformChange={(patch) =>
                onSetArtwork(zone.id, { ...art, ...patch })
              }
            />
          );
        })}
      </mesh>

      {wrapTexture && (
        <WrapOverlayMesh geometry={node.geometry} texture={wrapTexture} />
      )}
    </group>
  );
}