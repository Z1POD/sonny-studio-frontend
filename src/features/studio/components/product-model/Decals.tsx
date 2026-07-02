// src/features/studio/components/product-model/Decals.tsx

import { useRef, useMemo, useEffect } from "react";
import { Decal, TransformControls, useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { ArtworkState, PrintArea, TransformMode } from "../../store";
import {
  useDecalTransform,
  decomposeDecalTransform,
  getZoneTransformBounds,
  type DecalTransform,
  type ZoneTransformBounds,
} from "../../hooks/useDecalTransforms";
import { useDecalDragMove } from "../../hooks/useDecalDragMove";
import {
  useDecalCornerResize,
  CORNER_SIGN,
  type Corner,
} from "../../hooks/useDecalCornerResize";

// DecalMaterial

interface DecalMaterialProps {
  texture: THREE.Texture;
  polygonOffsetFactor?: number;
  selected?: boolean;
}

function DecalMaterial({
  texture,
  polygonOffsetFactor = -4,
  selected = false,
}: DecalMaterialProps) {
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
      color={selected ? new THREE.Color(0.5, 0.5, 0.54) : undefined}
      emissive={selected ? new THREE.Color("#2f5fe0") : undefined}
      emissiveIntensity={selected ? 0.12 : 0}
    />
  );
}

// DecalOutline

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

// DecalCornerHandles
// Four draggable pins, one per corner, rendered in the decal's own local
// plane (same position/rotation as the outline). Each pin is its own hit
// target with a fixed generous radius — independent of the artwork's own
// size — so tiny artwork is just as easy to grab as large artwork.

const CORNERS: Corner[] = ["tl", "tr", "bl", "br"];
const PIN_HIT_RADIUS = 0.018;
const PIN_OUTER_RADIUS = 0.009;
const PIN_INNER_RADIUS = 0.0052;
const PIN_LOCAL_Z = 0.003; // lifted slightly toward the camera along the decal's own normal

interface CornerHandleProps {
  corner: Corner;
  zone: PrintArea;
  transform: DecalTransform;
  artwork: ArtworkState;
  bounds: ZoneTransformBounds;
  onChange: (patch: Partial<ArtworkState>) => void;
  onSelect: (zoneId: string) => void;
}

function CornerHandle({
  corner,
  zone,
  transform,
  artwork,
  bounds,
  onChange,
  onSelect,
}: CornerHandleProps) {
  const handlers = useDecalCornerResize(zone, transform, artwork, bounds, onChange, onSelect, corner);
  const { sx, sy } = CORNER_SIGN[corner];
  const localPosition: [number, number, number] = [
    (sx * transform.scale.x) / 2,
    (sy * transform.scale.y) / 2,
    PIN_LOCAL_Z,
  ];

  return (
    <group position={localPosition} renderOrder={600}>
      {/* Generous invisible hit target, sized for touch regardless of artwork size */}
      <mesh
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerOver={handlers.onPointerOver}
        onPointerOut={handlers.onPointerOut}
      >
        <circleGeometry args={[PIN_HIT_RADIUS, 24]} />
        <meshBasicMaterial transparent opacity={0} depthTest={false} />
      </mesh>
      {/* Visible pin */}
      <mesh renderOrder={601}>
        <circleGeometry args={[PIN_OUTER_RADIUS, 24]} />
        <meshBasicMaterial color="#2f5fe0" depthTest={false} depthWrite={false} />
      </mesh>
      <mesh renderOrder={602} position={[0, 0, 0.0006]}>
        <circleGeometry args={[PIN_INNER_RADIUS, 24]} />
        <meshBasicMaterial color="#ffffff" depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

interface DecalCornerHandlesProps {
  zone: PrintArea;
  transform: DecalTransform;
  artwork: ArtworkState;
  bounds: ZoneTransformBounds;
  onChange: (patch: Partial<ArtworkState>) => void;
  onSelect: (zoneId: string) => void;
}

function DecalCornerHandles({
  zone,
  transform,
  artwork,
  bounds,
  onChange,
  onSelect,
}: DecalCornerHandlesProps) {
  return (
    <group position={transform.position} rotation={transform.rotation}>
      {CORNERS.map((corner) => (
        <CornerHandle
          key={corner}
          corner={corner}
          zone={zone}
          transform={transform}
          artwork={artwork}
          bounds={bounds}
          onChange={onChange}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

// DecalRotateGizmo
// Move and resize both happen via direct pointer interaction on the decal
// itself (interior drag + corner pins) — this gizmo is only for rotation,
// which still needs its own dedicated handle.

interface DecalRotateGizmoProps {
  zone: PrintArea;
  transform: DecalTransform;
  onChange: (patch: Partial<ArtworkState>) => void;
}

function DecalRotateGizmo({ zone, transform, onChange }: DecalRotateGizmoProps) {
  const handleRef = useRef<THREE.Group>(null!);
  const controlsRef = useRef<any>(null);
  const draggingRef = useRef(false);

  const orbitControls = useThree(
    (s) => s.controls
  ) as { enabled: boolean } | null;

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
      if (orbitControls) orbitControls.enabled = !e.value;
    };

    const handleObjectChange = () => {
      const handle = handleRef.current;
      if (!handle) return;
      const matrix = new THREE.Matrix4().compose(
        handle.position,
        handle.quaternion,
        handle.scale
      );
      const decomposed = decomposeDecalTransform(matrix, zone);
      onChange({ decalRotation: decomposed.rotation });
    };

    controls.addEventListener("dragging-changed", handleDraggingChanged);
    controls.addEventListener("objectChange", handleObjectChange);
    return () => {
      controls.removeEventListener("dragging-changed", handleDraggingChanged);
      controls.removeEventListener("objectChange", handleObjectChange);
    };
  }, [zone, onChange, orbitControls]);

  return (
    <>
      <group ref={handleRef} />
      <TransformControls
        ref={controlsRef}
        object={handleRef}
        mode="rotate"
        showX={false}
        showY={false}
        showZ
        size={0.85}
      />
    </>
  );
}

// SingleDecalLayer

interface SingleDecalLayerProps {
  artwork: ArtworkState;
  zone: PrintArea;
  meshNode: THREE.Mesh;
  texture: THREE.Texture;
  stackIndex?: number;
  isActive?: boolean;
  transformMode: TransformMode;
  onSelect: (zoneId: string) => void;
  onTransformChange: (patch: Partial<ArtworkState>) => void;
}

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
}: SingleDecalLayerProps) {
  const transform = useDecalTransform(zone, artwork, meshNode);
  const bounds = useMemo(() => getZoneTransformBounds(zone), [zone]);
  const moveHandlers = useDecalDragMove(zone, transform, bounds, onTransformChange, onSelect);

  if (!transform) return null;

  // Interior drag → move, always live directly on the artwork. Rotation is
  // still an explicit, exclusive mode (it needs its own dedicated handle),
  // so the rotate gizmo only shows up when transformMode is "rotate", and
  // move + the corner resize pins step aside while it's up so nothing
  // fights over the same pointer.
  const showRotateGizmo = isActive && transformMode === "rotate";
  const showCornerHandles = isActive && !showRotateGizmo && zone.allowScaling;

  const moveProps = showRotateGizmo
    ? {}
    : {
        onPointerDown: moveHandlers.onPointerDown,
        onPointerMove: moveHandlers.onPointerMove,
        onPointerUp: moveHandlers.onPointerUp,
        onPointerOver: moveHandlers.onPointerOver,
        onPointerOut: moveHandlers.onPointerOut,
      };

  return (
    <>
      <Decal
        position={transform.position}
        rotation={transform.rotation}
        scale={transform.scale}
        renderOrder={stackIndex + 1}
        onClick={(e: any) => {
          e.stopPropagation();
          onSelect(zone.id);
        }}
        {...moveProps}
      >
        <DecalMaterial
          texture={texture}
          polygonOffsetFactor={-4 - stackIndex}
          selected={isActive}
        />
      </Decal>

      {isActive && (
        <>
          <DecalOutline transform={transform} />
          {showCornerHandles && (
            <DecalCornerHandles
              zone={zone}
              transform={transform}
              artwork={artwork}
              bounds={bounds}
              onChange={onTransformChange}
              onSelect={onSelect}
            />
          )}
          {showRotateGizmo && (
            <DecalRotateGizmo
              zone={zone}
              transform={transform}
              onChange={onTransformChange}
            />
          )}
        </>
      )}
    </>
  );
}

// DecalLayer (public entry)

interface DecalLayerProps {
  artwork: ArtworkState;
  zone: PrintArea;
  meshNode: THREE.Mesh;
  stackIndex?: number;
  isActive?: boolean;
  transformMode: TransformMode;
  onSelect: (zoneId: string) => void;
  onTransformChange: (patch: Partial<ArtworkState>) => void;
}

export function DecalLayer({
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
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
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