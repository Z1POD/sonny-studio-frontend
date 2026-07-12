// src/features/market/components/viewer/ApparelMesh.tsx

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Viewer3D, ViewerPrintArea } from "../../api";
import { MeshNode } from "@/features/studio/components/product-model/MeshNode";
import { useWrapArtworkTexture } from "@/features/studio/hooks/useWrapArtworkTexture";
import {
  adaptViewerArtworks,
  adaptViewerMaterial,
  adaptViewerPrintAreas,
} from "./adaptViewerPrintAreas";

interface Props {
  modelUrl: string;
  colorHex: string;
  material?: Viewer3D["material"];
  modelPosition?: [number, number, number];
  colorableMeshes?: string[];
  printAreas?: ViewerPrintArea[];
  /** Slow auto-spin — a marketplace-only nicety, off by default so the
   *  preview matches Studio's static camera unless explicitly requested. */
  autoRotate?: boolean;
}

export function ApparelMesh({
  modelUrl,
  colorHex,
  material,
  modelPosition,
  colorableMeshes = [],
  printAreas = [],
  autoRotate = true,
}: Props) {
  const { nodes } = useGLTF(modelUrl);

  const meshNodes = useMemo(
    () => Object.values(nodes).filter((n): n is THREE.Mesh => n instanceof THREE.Mesh),
    [nodes],
  );

  const studioPrintAreas = useMemo(() => adaptViewerPrintAreas(printAreas), [printAreas]);
  const artworks = useMemo(() => adaptViewerArtworks(printAreas), [printAreas]);
  const materialConfig = useMemo(() => adaptViewerMaterial(material), [material]);

  // Same full-wrap detection Studio's ProductModel uses — `placement ===
  // "wrap"` after adaptViewerPrintAreas normalizes the marketplace API's
  // "full" to Studio's "wrap".
  const wrapZone = useMemo(
    () => studioPrintAreas.find((z) => z.placement === "wrap" && !!artworks[z.id]?.decalUrl),
    [studioPrintAreas, artworks],
  );
  const wrapTexture = useWrapArtworkTexture(wrapZone ? artworks[wrapZone.id] : undefined);

  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (autoRotate && group.current) group.current.rotation.y += dt * 0.25;
  });

  return (
    <group ref={group} position={modelPosition ?? [0, 0, 0]}>
      {meshNodes.map((node) => (
        <MeshNode
          key={node.uuid}
          node={node}
          printAreas={studioPrintAreas}
          artworks={artworks}
          layerOrder={[]}
          selectedPrintAreaId={null}
          transformMode="translate"
          wrapTexture={wrapTexture}
          selectedColor={colorHex}
          colorableMeshes={colorableMeshes}
          materialConfig={materialConfig}
          editable={false}
        />
      ))}
    </group>
  );
}