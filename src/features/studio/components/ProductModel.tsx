// src/features/studio/components/ProductModel.tsx

import { Decal, useGLTF, useTexture } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { ArtworkState, PrintArea } from "../store";
import {
  useDecalTransform,
  computeWrapTextureTransform,
  applyWrapTextureTransform,
} from "../hooks/useDecalTransforms";


// Shared decal material─
// Extracted to avoid repeating the same JSX props on every Decal instance.

function DecalMaterial({ texture }: { texture: THREE.Texture }) {
  return (
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
  );
}


// DecalLayer──

interface DecalLayerProps {
  artwork: ArtworkState;
  zone: PrintArea;
  meshNode: THREE.Mesh;
}

function DecalLayer({ artwork, zone, meshNode }: DecalLayerProps) {
  const texture = useTexture(artwork.decalUrl || "");

  useMemo(() => {
    if (!texture) return;
    texture.colorSpace  = THREE.SRGBColorSpace;
    texture.wrapS       = THREE.ClampToEdgeWrapping;
    texture.wrapT       = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
  }, [texture]);

  if (!texture) return null;

  if (zone.placement === "wrap") return null;

  return <SingleDecalLayer artwork={artwork} zone={zone} meshNode={meshNode} texture={texture} />;
}


// SingleDecalLayer──
// One decal placed on the zone's designated surface.

function SingleDecalLayer({
  artwork,
  zone,
  meshNode,
  texture,
}: DecalLayerProps & { texture: THREE.Texture }) {
  const transform = useDecalTransform(zone, artwork, meshNode);
  if (!transform) return null;

  return (
    <Decal
      position={transform.position}
      rotation={transform.rotation}
      scale={transform.scale}
    >
      <DecalMaterial texture={texture} />
    </Decal>
  );
}


// Material builder

interface UseMaterialProps {
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

function useBuiltMaterial({
  node,
  selectedColor,
  colorableMeshes,
  materialConfig,
}: UseMaterialProps): THREE.Material {
  const diffuse = materialConfig?.textureUrl   ? useTexture(materialConfig.textureUrl)   : null;
  const normal  = materialConfig?.normalMapUrl ? useTexture(materialConfig.normalMapUrl) : null;

  const material = useMemo(() => {
    const isColorable =
      colorableMeshes.length === 0 ||
      colorableMeshes.some((n) => node.name.toLowerCase().includes(n.toLowerCase()));

    const hasTexture = !!materialConfig?.textureUrl;
    const hasNormal  = !!materialConfig?.normalMapUrl;
    const hasColor   = isColorable && !!selectedColor;

    if (!hasColor && !hasTexture && !hasNormal) {
      return node.material as THREE.Material;
    }

    if (hasTexture && diffuse) diffuse.colorSpace = THREE.SRGBColorSpace;

    return new THREE.MeshStandardMaterial({
      color:     hasColor   ? new THREE.Color(selectedColor!) : undefined,
      map:       hasTexture ? diffuse : null,
      normalMap: hasNormal  ? normal  : null,
      roughness: materialConfig?.roughness ?? 0.9,
      metalness: materialConfig?.metalness ?? 0,
      side:      THREE.DoubleSide,
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


const wrapTextureLoader = new THREE.TextureLoader();

function useWrapArtworkTexture(artwork: ArtworkState | undefined): THREE.Texture | null {
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
      },
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




function zoneTargetsMesh(zone: PrintArea, meshName: string): boolean {
  if (!zone.meshName) return true;
  return meshName.toLowerCase().includes(zone.meshName.toLowerCase());
}


function WrapOverlayMesh({
  geometry,
  texture,
}: {
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture;
}) {
  return (
    <mesh geometry={geometry} renderOrder={1}>
      <meshStandardMaterial
        map={texture}
        transparent
        alphaTest={0.02}
        depthTest
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-4}
        polygonOffsetUnits={-4}
        roughness={0.9}
        metalness={0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}


// ProductModel

interface ProductModelProps {
  modelUrl: string;
  printAreas: PrintArea[];
  artworks: Record<string, ArtworkState>;
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
  selectedColor,
  colorableMeshes = [],
  materialConfig,
}: ProductModelProps) {
  const { nodes } = useGLTF(modelUrl);

  const meshNodes = useMemo(
    () => Object.values(nodes).filter((n): n is THREE.Mesh => n instanceof THREE.Mesh),
    [nodes],
  );

  const wrapZone = useMemo(
    () => printAreas.find((z) => z.placement === "wrap" && !!artworks[z.id]?.decalUrl),
    [printAreas, artworks],
  );
  const wrapArtwork = wrapZone ? artworks[wrapZone.id] : undefined;
  const wrapTexture = useWrapArtworkTexture(wrapArtwork);

  return (
    <group>
      {meshNodes.map((node) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const material = useBuiltMaterial({ node, selectedColor, colorableMeshes, materialConfig });
        const zonesForMesh = printAreas.filter(
          (z) => z.placement !== "wrap" && zoneTargetsMesh(z, node.name),
        );

        return (
          <group key={node.uuid}>
            <mesh
              castShadow
              receiveShadow
              geometry={node.geometry}
              material={material}
            >
              {zonesForMesh.map((zone) => {
                const art = artworks[zone.id];
                if (!art?.decalUrl) return null;
                return (
                  <DecalLayer
                    key={zone.id}
                    artwork={art}
                    zone={zone}
                    meshNode={node}
                  />
                );
              })}
            </mesh>

            {/* All-over print: layered on top of the base mesh above, never replacing its material. */}
            {wrapTexture && <WrapOverlayMesh geometry={node.geometry} texture={wrapTexture} />}
          </group>
        );
      })}
    </group>
  );
}