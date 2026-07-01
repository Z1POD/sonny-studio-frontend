// src/features/studio/components/ProductModel.tsx

import { Decal, useGLTF, useTexture, TransformControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { ArtworkState, PrintArea, TransformMode } from "../store";
import { useStudioStore } from "../store";
import {
  useDecalTransform,
  computeWrapTextureTransform,
  applyWrapTextureTransform,
  decomposeDecalTransform,
  getZoneTransformBounds,
  type DecalTransform,
  type ZoneTransformBounds,
} from "../hooks/useDecalTransforms";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// In-plane movement (metres) the pointer must travel before a press on a
// decal is treated as a drag rather than a tap — keeps a simple "select"
// tap from nudging the artwork by a sub-pixel amount.
const DRAG_THRESHOLD = 0.0025;

// Shared decal material─
// Extracted to avoid repeating the same JSX props on every Decal instance.

function DecalMaterial({
  texture,
  polygonOffsetFactor = -4,
  selected = false,
}: {
  texture: THREE.Texture;
  polygonOffsetFactor?: number;
  /** Darkened + lightly glowing so it's obvious which decal is active. */
  selected?: boolean;
}) {
  return (
    <meshStandardMaterial
      map={texture}
      transparent
      alphaTest={0.02}
      depthTest
      depthWrite={false}
      polygonOffset
      polygonOffsetFactor={polygonOffsetFactor}
      polygonOffsetUnits={polygonOffsetFactor}
      // Multiplies the artwork's own colors down (a plain darken, not a
      // color tint) so it reads clearly as "selected" without fighting the
      // art itself. Pushed noticeably darker than the old subtle state —
      // this is the primary cue that the decal is live for gizmo edits.
      color={selected ? new THREE.Color(0.5, 0.5, 0.54) : undefined}
      emissive={selected ? new THREE.Color("#2f5fe0") : undefined}
      emissiveIntensity={selected ? 0.12 : 0}
    />
  );
}


// DecalOutline──
// Dashed rectangle traced around the active decal's bounds, in the same
// local frame as the Decal/gizmo. Cheap: it's just a 5-point line loop
// sized from transform.scale, nudged in front via polygon offset (same
// trick the material above uses) so it doesn't z-fight the artwork.

function DecalOutline({ transform }: { transform: DecalTransform }) {
  const lineRef = useRef<THREE.Line>(null!);

  const geometry = useMemo(() => {
    const w = transform.scale.x / 2;
    const h = transform.scale.y / 2;
    const points = [
      new THREE.Vector3(-w, -h, 0),
      new THREE.Vector3(w, -h, 0),
      new THREE.Vector3(w, h, 0),
      new THREE.Vector3(-w, h, 0),
      new THREE.Vector3(-w, -h, 0),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [transform.scale.x, transform.scale.y]);

  useEffect(() => {
    lineRef.current?.computeLineDistances();
  }, [geometry]);

  return (
    <line
      ref={lineRef}
      geometry={geometry}
      position={transform.position}
      rotation={transform.rotation}
      renderOrder={500}
    >
      <lineDashedMaterial
        color="#2f5fe0"
        dashSize={0.012}
        gapSize={0.008}
        transparent
        opacity={0.9}
        depthTest
        polygonOffset
        polygonOffsetFactor={-8}
        polygonOffsetUnits={-8}
      />
    </line>
  );
}


// useDecalDragTranslate──
// Direct-manipulation move: press+drag the artwork itself, like dragging a
// sticker. This is what makes the studio usable on a phone — no need to
// land a finger precisely on a thin 3D arrow. Works by raycasting the
// pointer against a plane through the decal (oriented along the same axes
// computeDecalTransform uses), then reusing decomposeDecalTransform to
// convert the resulting world position back into offsetX/offsetY — the
// exact same math path the TransformControls gizmo uses, so the two never
// disagree about sign conventions.

function useDecalDragTranslate(
  zone: PrintArea,
  transform: DecalTransform | null,
  bounds: ZoneTransformBounds,
  onChange: (patch: Partial<ArtworkState>) => void,
  onSelect: (zoneId: string) => void,
) {
  const planeRef = useRef(new THREE.Plane());
  const dragRef = useRef<{ grabOffset: THREE.Vector3; startHit: THREE.Vector3; moved: boolean } | null>(null);

  const onPointerDown = (e: any) => {
    if (!transform) return;
    e.stopPropagation();
    onSelect(zone.id);
    (e.target as Element)?.setPointerCapture?.(e.pointerId);

    const normal = new THREE.Vector3(0, 0, 1).applyEuler(transform.rotation);
    planeRef.current.setFromNormalAndCoplanarPoint(normal, transform.position);

    const hit = new THREE.Vector3();
    if (e.ray.intersectPlane(planeRef.current, hit)) {
      dragRef.current = {
        grabOffset: transform.position.clone().sub(hit),
        startHit: hit.clone(),
        moved: false,
      };
    }
  };

  const onPointerMove = (e: any) => {
    if (!dragRef.current || !transform) return;
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(planeRef.current, hit)) return;

    if (!dragRef.current.moved) {
      if (hit.distanceTo(dragRef.current.startHit) < DRAG_THRESHOLD) return;
      dragRef.current.moved = true;
    }

    const newPosition = hit.clone().add(dragRef.current.grabOffset);
    const matrix = new THREE.Matrix4().compose(
      newPosition,
      new THREE.Quaternion().setFromEuler(transform.rotation),
      transform.scale,
    );
    const decomposed = decomposeDecalTransform(matrix, zone);
    onChange({
      decalOffsetX: clamp(decomposed.offsetX, bounds.minX, bounds.maxX),
      decalOffsetY: clamp(decomposed.offsetY, bounds.minY, bounds.maxY),
    });
  };

  const onPointerUp = (e: any) => {
    dragRef.current = null;
    (e.target as Element)?.releasePointerCapture?.(e.pointerId);
  };

  return { onPointerDown, onPointerMove, onPointerUp };
}


// DecalTransformGizmo──
// An invisible proxy object driven by the store-computed decal transform.
// TransformControls manipulates the proxy directly; every drag frame we
// decompose the proxy's local matrix back into offset/scale/rotation and
// write it to the store, so the panel sliders and the on-model gizmo always
// agree — they both just read/write the same ArtworkState fields.
// Only mounted for rotate/scale — translate is handled by direct dragging
// on the decal itself (see useDecalDragTranslate), which is far easier to
// use on a touchscreen than grabbing a thin arrow.

function DecalTransformGizmo({
  zone,
  transform,
  mode,
  onChange,
}: {
  zone: PrintArea;
  transform: DecalTransform;
  mode: TransformMode;
  onChange: (patch: Partial<ArtworkState>) => void;
}) {
  const handleRef = useRef<THREE.Group>(null!);
  const controlsRef = useRef<any>(null);
  const draggingRef = useRef(false);

  const bounds = useMemo(() => getZoneTransformBounds(zone), [zone]);

  // Keep the proxy synced to the latest store-derived transform — but never
  // while the user actively has it grabbed, or we'd fight their drag.
  useEffect(() => {
    if (draggingRef.current || !handleRef.current) return;
    handleRef.current.position.copy(transform.position);
    handleRef.current.rotation.copy(transform.rotation);
    handleRef.current.scale.copy(transform.scale);
  }, [transform]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const handleDraggingChanged = (e: any) => {
      draggingRef.current = e.value;
    };

    const handleObjectChange = () => {
      const handle = handleRef.current;
      if (!handle) return;
      // The proxy lives inside the same parent <mesh> as the <Decal> it
      // mirrors, so its local position/quaternion/scale are already in the
      // exact frame computeDecalTransform() produced them in — no need to
      // walk matrixWorld, just compose+decompose directly.
      const matrix = new THREE.Matrix4().compose(handle.position, handle.quaternion, handle.scale);
      const decomposed = decomposeDecalTransform(matrix, zone);
      onChange({
        decalOffsetX: clamp(decomposed.offsetX, bounds.minX, bounds.maxX),
        decalOffsetY: clamp(decomposed.offsetY, bounds.minY, bounds.maxY),
        decalScale: clamp(decomposed.scale, bounds.minScale, bounds.maxScale),
        decalRotation: decomposed.rotation,
      });
    };

    controls.addEventListener("dragging-changed", handleDraggingChanged);
    controls.addEventListener("objectChange", handleObjectChange);
    return () => {
      controls.removeEventListener("dragging-changed", handleDraggingChanged);
      controls.removeEventListener("objectChange", handleObjectChange);
    };
  }, [zone, bounds, onChange]);

  // scale: Y only (X is derived from Y × aspect elsewhere in the pipeline,
  // so a single handle keeps the gizmo unambiguous)
  // rotate: Z only (spin around the surface normal)
  const showY = mode === "scale";
  const showZ = mode === "rotate";

  return (
    <>
      <group ref={handleRef} />
      <TransformControls
        ref={controlsRef}
        object={handleRef}
        mode={mode}
        showX={false}
        showY={showY}
        showZ={showZ}
        // Bigger than the drei default — easier to land a finger on.
        size={0.85}
      />
    </>
  );
}


// DecalLayer──

interface DecalLayerProps {
  artwork: ArtworkState;
  zone: PrintArea;
  meshNode: THREE.Mesh;
  /** Position within this mesh's layer stack, 0 = bottom. Drives renderOrder
   *  and polygon offset so layers composite in the order set in LayerManager. */
  stackIndex?: number;
  /** Whether this zone is the one currently driven by the on-model gizmo. */
  isActive?: boolean;
  transformMode: TransformMode;
  onSelect: (zoneId: string) => void;
  onTransformChange: (patch: Partial<ArtworkState>) => void;
}

function DecalLayer({
  artwork,
  zone,
  meshNode,
  stackIndex = 0,
  isActive = false,
  transformMode,
  onSelect,
  onTransformChange,
}: DecalLayerProps) {
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

  return (
    <SingleDecalLayer
      artwork={artwork}
      zone={zone}
      meshNode={meshNode}
      texture={texture}
      stackIndex={stackIndex}
      isActive={isActive}
      transformMode={transformMode}
      onSelect={onSelect}
      onTransformChange={onTransformChange}
    />
  );
}


// SingleDecalLayer──
// One decal placed on the zone's designated surface, plus (when active) its
// highlight, dashed outline, drag-to-move handling, and rotate/scale gizmo.

function SingleDecalLayer({
  artwork,
  zone,
  meshNode,
  texture,
  stackIndex = 0,
  isActive = false,
  transformMode,
  onSelect,
  onTransformChange,
}: DecalLayerProps & { texture: THREE.Texture }) {
  const transform = useDecalTransform(zone, artwork, meshNode);
  const bounds = useMemo(() => getZoneTransformBounds(zone), [zone]);
  const dragHandlers = useDecalDragTranslate(zone, transform, bounds, onTransformChange, onSelect);

  if (!transform) return null;

  const dragProps =
    transformMode === "translate"
      ? {
          onPointerDown: dragHandlers.onPointerDown,
          onPointerMove: dragHandlers.onPointerMove,
          onPointerUp: dragHandlers.onPointerUp,
        }
      : {};

  return (
    <>
      <Decal
        position={transform.position}
        rotation={transform.rotation}
        scale={transform.scale}
        // Higher stackIndex = added later = rendered later = visually on top.
        renderOrder={stackIndex + 1}
        onClick={(e: any) => {
          e.stopPropagation();
          onSelect(zone.id);
        }}
        {...dragProps}
      >
        <DecalMaterial texture={texture} polygonOffsetFactor={-4 - stackIndex} selected={isActive} />
      </Decal>

      {isActive && (
        <>
          <DecalOutline transform={transform} />
          {transformMode !== "translate" && (
            <DecalTransformGizmo
              zone={zone}
              transform={transform}
              mode={transformMode}
              onChange={onTransformChange}
            />
          )}
        </>
      )}
    </>
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
  /** Ordered list of print-area ids, bottom→top, from the studio store's layerOrder.
   *  Drives both renderOrder and a staggered polygon offset so layers reliably
   *  composite in the order the user set in LayerManager. */
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

  // Gizmo-related store slices. Pulled directly (rather than threaded down
  // as props from StudioCanvas) since they're purely a ProductModel/on-model
  // concern — same pattern LayerManager already uses for store access.
  const selectedPrintAreaId = useStudioStore((s) => s.selectedPrintAreaId);
  const transformMode       = useStudioStore((s) => s.transformMode);
  const setSelectedPrintArea = useStudioStore((s) => s.setSelectedPrintArea);
  const setArtwork           = useStudioStore((s) => s.setArtwork);

  // OrbitControls registers itself here via `makeDefault` in StudioCanvas.
  // While a decal is active (selected for gizmo manipulation — translate,
  // rotate, or scale) camera orbiting is locked, so a pointer drag on the
  // artwork or a gizmo handle can never be mistaken for an orbit gesture.
  // Centralized here (rather than toggled per-drag inside the gizmo) so it
  // covers direct-drag translate too, and doesn't get re-enabled the moment
  // a single rotate/scale drag ends while the decal is still selected.
  const orbitControls = useThree((s) => s.controls) as { enabled: boolean } | null;
  useEffect(() => {
    if (!orbitControls) return;
    orbitControls.enabled = !selectedPrintAreaId;
    return () => {
      orbitControls.enabled = true;
    };
  }, [selectedPrintAreaId, orbitControls]);

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
        const zonesForMesh = printAreas
          .filter((z) => z.placement !== "wrap" && zoneTargetsMesh(z, node.name))
          .sort((a, b) => {
            const ai = layerOrder.indexOf(a.id);
            const bi = layerOrder.indexOf(b.id);
            // Ids not present in layerOrder (no artwork yet, or order not loaded)
            // sort to the bottom rather than breaking the comparator.
            return (ai === -1 ? -Infinity : ai) - (bi === -1 ? -Infinity : bi);
          });

        return (
          <group key={node.uuid}>
            <mesh
              castShadow
              receiveShadow
              geometry={node.geometry}
              material={material}
              // Clicking the bare garment (not a decal — those stop
              // propagation before this fires) deselects the active decal.
              onClick={(e: any) => {
                e.stopPropagation();
                setSelectedPrintArea(null);
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
                    onSelect={setSelectedPrintArea}
                    onTransformChange={(patch) => setArtwork(zone.id, { ...art, ...patch })}
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