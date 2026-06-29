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


// ─── Shared decal material ────────────────────────────────────────────────────
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


// ─── DecalLayer ───────────────────────────────────────────────────────────────

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

  // "wrap" (all-over print) is rendered as a UV-mapped material.map on every
  // mesh the garment is made of — see useWrapTexture / useBuiltMaterial below.
  // It is intentionally NOT rendered here as a child Decal: Decal only paints
  // triangles directly under its own projector on the single mesh it's
  // nested inside, so it can never reach panels (back, sleeves) that live on
  // a different mesh node — which is exactly why "wrap" used to render
  // front-only. "full" (single-surface print) keeps using Decal, since that
  // correctly targets one designated face.
  if (zone.placement === "wrap") return null;

  return <SingleDecalLayer artwork={artwork} zone={zone} meshNode={meshNode} texture={texture} />;
}


// ─── SingleDecalLayer ────────────────────────────────────────────────────────
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


// NOTE: all-over "wrap" placement is no longer implemented as stacked Decal
// projectors. See WrapOverlayMesh below: the artwork is applied as a real,
// repeating UV map on a second mesh that shares the garment's geometry and
// sits on top of (not instead of) the garment's own opaque material — the
// only approach that both (a) reliably covers every panel of a multi-mesh
// garment, since Decal cannot reach geometry outside the single mesh it's
// nested in, and (b) doesn't erase the garment wherever the artwork's PNG is
// transparent. Baking the artwork directly into the base material's `map`
// (an earlier version of this fix) made `transparent: true` blend against
// whatever's *behind* the mesh for every alpha pixel, instead of showing the
// garment's own surface there — which looked like the artwork "cutting out"
// the model.


// ─── Material builder ─────────────────────────────────────────────────────────

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

    // Mirror the original MaterialApplier behaviour exactly:
    // if none of the overrides are active, leave the GLB's baked material
    // untouched so the shirt keeps its original look.
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

  // Dispose the previously-generated material whenever this memo recomputes
  // a new one (color change, etc). Materials sourced straight from the GLB
  // (the "leave it untouched" branch above) must never be disposed here —
  // they're owned by the loaded GLTF cache, not by us.
  const isOwned = material !== node.material;
  useEffect(() => {
    return () => {
      if (isOwned) material.dispose();
    };
  }, [material, isOwned]);

  return material;
}


// ─── Wrap (all-over print) texture ─────────────────────────────────────────────
//
// One shared texture for the whole garment — loaded once per artwork URL and
// reused across every mesh node, rather than the previous per-face Decal
// approach (which required a separate Decal per mesh and still couldn't
// reach geometry outside whichever single mesh got matched).
//
// IMPORTANT: this intentionally does NOT use drei's useTexture(). useTexture
// calls useLoader under the hood, which fires immediately regardless of
// whether the URL is empty — useLoader("") still reaches into
// TextureLoader.load(""), which resolves against the current document URL
// and throws ("Could not load : undefined"). DecalLayer gets away with the
// same-looking pattern only because its parent never mounts it until
// art.decalUrl is already truthy; this hook runs unconditionally on every
// ProductModel render (there may be no wrap zone, or no artwork on it yet),
// so it needs to gate loading itself rather than relying on a caller to do
// it. A plain THREE.TextureLoader, only invoked when a URL exists, sidesteps
// the suspense/loader pipeline entirely for the "no wrap artwork" case.

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
        // glTF/GLB UVs are authored with a top-left origin (per the glTF
        // spec), but THREE.TextureLoader defaults flipY to true, which is
        // meant for textures sampled against the legacy bottom-left-origin
        // convention. Decal doesn't hit this because it builds its own UVs
        // at runtime for the projected patch; WrapOverlayMesh instead
        // samples the model's actual baked UVs, so flipY must be disabled
        // or the artwork renders upside-down relative to the garment.
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
      // Dispose whatever finished loading for this effect run; if the URL
      // changes again before load completes, the in-flight texture above
      // gets disposed via the `cancelled` check instead.
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


// ─── WrapOverlayMesh ────────────────────────────────────────────────────────────
//
// Renders the all-over artwork as a SECOND mesh sharing the garment's own
// geometry, layered on top of the (still fully opaque, unmodified) base
// mesh — the same layering principle as DecalMaterial, just spread across
// the whole UV space instead of projected through a Decal.
//
// Why a second mesh instead of putting the texture on the base material:
// `transparent: true` makes a material blend against whatever is already in
// the colour buffer *behind that mesh* (background / nothing), not against
// "the rest of this same surface". So wherever the artwork PNG is
// transparent (the gaps between tiger stripes, soft edges, etc.), baking it
// into the base material's `map` made the garment itself disappear there
// instead of showing the garment's own colour/fabric. Keeping the base mesh
// untouched and adding this overlay on top — with depthWrite disabled and a
// tiny polygon offset, exactly like Decal does — means alpha pixels simply
// let the base mesh underneath show through, while opaque pixels paint the
// artwork. alphaTest (rather than only `transparent`) also avoids
// depth/blend-order artifacts on overlapping/self-intersecting geometry.

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


// ─── ProductModel ─────────────────────────────────────────────────────────────

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

  // "wrap" placement is whole-garment by definition — at most one wrap zone
  // is meaningfully active at a time, and its texture applies to every mesh
  // regardless of zoneTargetsMesh (which only makes sense for single-surface
  // "full" zones tied to one named mesh/panel).
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