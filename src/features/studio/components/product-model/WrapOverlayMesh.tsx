// src/features/studio/components/product-model/WrapOverlayMesh.tsx

import { useMemo } from "react";
import * as THREE from "three";

interface WrapOverlayMeshProps {
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture;
}

function useCylindricalUvGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  return useMemo(() => {
    // Non-indexed: every triangle gets its own 3 vertices, so seam fixes
    // below can adjust one triangle's UVs without disturbing vertices
    // shared by triangles on the other side of the seam.
    const cloned = geometry.index ? geometry.toNonIndexed() : geometry.clone();
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

    const vertexCount = position.count;
    const u = new Float32Array(vertexCount);
    const v = new Float32Array(vertexCount);

    for (let i = 0; i < vertexCount; i++) {
      const x = position.getX(i) - centerX;
      const y = position.getY(i);
      const z = position.getZ(i) - centerZ;
      u[i] = Math.atan2(x, z) / (Math.PI * 2) + 0.5; // 0..1
      // The wrap texture has flipY=false (useWrapArtworkTexture.ts), which
      // means UV v=0 maps to the *top* row of the source image. So the
      // object's top (maxY) must land at v=0 — not v=1 — or the artwork
      // renders upside-down on the model.
      v[i] = (maxY - y) / heightRange;
    }

    // Seam fix: for every triangle (3 consecutive vertices, guaranteed by
    // toNonIndexed), if its U values span more than half the texture
    // width it's crossing the atan2 branch cut — push its low-side
    // vertices past 1.0 so the triangle's own UV span becomes small and
    // continuous again.
    for (let t = 0; t < vertexCount; t += 3) {
      const ua = u[t];
      const ub = u[t + 1];
      const uc = u[t + 2];
      const maxU = Math.max(ua, ub, uc);
      const minU = Math.min(ua, ub, uc);
      if (maxU - minU > 0.5) {
        if (ua < 0.5) u[t] += 1;
        if (ub < 0.5) u[t + 1] += 1;
        if (uc < 0.5) u[t + 2] += 1;
      }
    }

    const uv = new Float32Array(vertexCount * 2);
    for (let i = 0; i < vertexCount; i++) {
      uv[i * 2] = u[i];
      uv[i * 2 + 1] = v[i];
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