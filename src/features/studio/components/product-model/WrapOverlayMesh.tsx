// src/features/studio/components/product-model/WrapOverlayMesh.tsx

import * as THREE from "three";

interface WrapOverlayMeshProps {
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture;
}

export function WrapOverlayMesh({ geometry, texture }: WrapOverlayMeshProps) {
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