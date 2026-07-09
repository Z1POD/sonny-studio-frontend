// src/features/studio/components/product-model/WrapOverlayMesh.tsx

import { useMemo } from "react";
import * as THREE from "three";

interface WrapOverlayMeshProps {
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture;
}

function useCylindricalUvGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  return useMemo(() => {
    // Clone — never mutate the shared geometry, which the base colored
    // mesh (MeshNode's own <mesh>) renders from too.
    const cloned = geometry.clone();
    const position = cloned.attributes.position;
    cloned.computeBoundingBox();
    const bbox = cloned.boundingBox!;
    const minY = bbox.min.y;
    const maxY = bbox.max.y;
    const heightRange = Math.max(maxY - minY, 1e-6);
    // Center the angle calculation on the mesh's actual bounding-box
    // center, not the local origin — an off-center pivot (common on
    // exported/auto-generated models) otherwise skews angular density
    // unevenly around the circumference, reading as extra stretching on
    // one side.
    const centerX = (bbox.max.x + bbox.min.x) / 2;
    const centerZ = (bbox.max.z + bbox.min.z) / 2;

    const uv = new Float32Array(position.count * 2);
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i) - centerX;
      const y = position.getY(i);
      const z = position.getZ(i) - centerZ;
      const u = Math.atan2(x, z) / (Math.PI * 2) + 0.5;
      // The wrap texture has flipY=false (useWrapArtworkTexture.ts), which
      // means UV v=0 maps to the *top* row of the source image. So the
      // object's top (maxY) must land at v=0 — not v=1 — or the artwork
      // renders upside-down on the model.
      const v = (maxY - y) / heightRange;
      uv[i * 2] = u;
      uv[i * 2 + 1] = v;
    }
    cloned.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    return cloned;
  }, [geometry]);
}

export function WrapOverlayMesh({ geometry, texture }: WrapOverlayMeshProps) {
  const cylindricalGeometry = useCylindricalUvGeometry(geometry);

  return (
    <mesh geometry={cylindricalGeometry} renderOrder={1}>
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