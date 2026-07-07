// src/features/market/components/viewer/ApparelMesh.tsx
//
// Renders a product's rigged GLB model for the marketplace's read-only 3D
// preview. Unlike the studio/configurator version this is adapted from,
// there's no procedural primitive fallback here — every marketplace
// product with a `viewer_3d` block ships a real `model_url`, so
// `ProductDetailPage` only mounts this component when one exists.
//
// Print areas render one of two ways:
//  - normal zone (front/back/sleeve): a projected Decal, positioned via
//    useMarketDecalTransform's computeViewerDecalTransform.
//  - full-wrap zone (mugs, bottles, all-over prints): the decal is applied
//    directly as the mesh's own UV-wrapped texture instead — see
//    isFullWrapZone()/computeWrapTextureTransform in the same module.

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Decal, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { Viewer3D, ViewerPrintArea } from "../../api";
import {
  applyWrapTextureTransform,
  computeViewerDecalTransform,
  computeWrapTextureTransform,
  isFullWrapZone,
  type DecalTransform,
} from "./useMarketDecalTransform";

interface Props {
  modelUrl: string;
  colorHex: string;
  material?: Viewer3D["material"];
  modelPosition?: [number, number, number];
  colorableMeshes?: string[];
  printAreas?: ViewerPrintArea[];
}

export function ApparelMesh({
  modelUrl,
  colorHex,
  material,
  modelPosition,
  colorableMeshes = [],
  printAreas = [],
}: Props) {
  const { nodes } = useGLTF(modelUrl);

  const meshNodes = useMemo(
    () => Object.values(nodes).filter((n): n is THREE.Mesh => n instanceof THREE.Mesh),
    [nodes],
  );

  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.15;
  });

  return (
    <group ref={group} position={modelPosition ?? [0, 0, 0]}>
      {meshNodes.map((node) => {
        const zonesForMesh = printAreas.filter((pa) =>
          pa.mesh_name ? node.name.toLowerCase().includes(pa.mesh_name.toLowerCase()) : true,
        );
        return (
          <ColoredMesh
            key={node.uuid}
            node={node}
            colorHex={colorHex}
            colorableMeshes={colorableMeshes}
            material={material}
            printAreas={zonesForMesh}
          />
        );
      })}
    </group>
  );
}

function ColoredMesh({
  node,
  colorHex,
  colorableMeshes,
  material,
  printAreas,
}: {
  node: THREE.Mesh;
  colorHex: string;
  colorableMeshes: string[];
  material?: Viewer3D["material"];
  printAreas: ViewerPrintArea[];
}) {
  const diffuse = material?.texture_url ? useTexture(material.texture_url) : null;

  // Full-wrap zone (mug, bottle, all-over print): its decal becomes the
  // mesh's own texture map, not a projected Decal — see isFullWrapZone().
  const wrapZone = printAreas.find((pa) => isFullWrapZone(pa) && pa.decal?.url);
  const wrapTexture = wrapZone ? useTexture(wrapZone.decal!.url) : null;

  const isColorable =
    colorableMeshes.length === 0 ||
    colorableMeshes.some((n) => node.name.toLowerCase().includes(n.toLowerCase()));

  const hasTexture = !!material?.texture_url;
  const hasColor = isColorable && !!colorHex;
  const hasWrap = !!wrapZone && !!wrapTexture;

  const builtMaterial = useMemo(() => {
    if (hasWrap && wrapTexture && wrapZone) {
      wrapTexture.colorSpace = THREE.SRGBColorSpace;
      applyWrapTextureTransform(wrapTexture, computeWrapTextureTransform(wrapZone.decal!));
      return new THREE.MeshStandardMaterial({
        map: wrapTexture,
        roughness: material?.roughness ?? 0.9,
        metalness: material?.metalness ?? 0,
        side: THREE.DoubleSide,
      });
    }
    if (!hasColor && !hasTexture) {
      return node.material as THREE.Material;
    }
    if (hasTexture && diffuse) diffuse.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      color: hasColor ? new THREE.Color(colorHex) : undefined,
      map: hasTexture ? diffuse : null,
      roughness: material?.roughness ?? 0.9,
      metalness: material?.metalness ?? 0,
      side: THREE.DoubleSide,
    });
  }, [node, hasColor, hasTexture, hasWrap, colorHex, diffuse, wrapTexture, wrapZone, material?.roughness, material?.metalness]);

  // The wrap zone is already painted on as the base texture above, so it's
  // excluded here — only non-wrap zones still render as projected decals.
  const overlayPrintAreas = printAreas.filter((pa) => pa.decal?.url && !isFullWrapZone(pa));

  return (
    <mesh castShadow receiveShadow geometry={node.geometry} material={builtMaterial}>
      {overlayPrintAreas.map((pa) => (
        <BakedDecal key={pa.area_key} printArea={pa} meshNode={node} />
      ))}
    </mesh>
  );
}

/** Renders a single print area's already-baked decal — no drag/scale/rotate
 *  controls here, this is a finished product preview. */
function BakedDecal({ printArea, meshNode }: { printArea: ViewerPrintArea; meshNode: THREE.Mesh }) {
  const decal = printArea.decal!;
  const texture = useTexture(decal.url);

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
  }, [texture]);

  const transform: DecalTransform | null = useMemo(
    () => computeViewerDecalTransform(printArea, meshNode),
    [printArea, meshNode],
  );

  if (!transform) return null;

  return (
    <Decal position={transform.position} rotation={transform.rotation} scale={transform.scale}>
      <meshStandardMaterial
        map={texture}
        transparent
        alphaTest={0.02}
        depthTest
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-4}
        polygonOffsetUnits={-4}
      />
    </Decal>
  );
}