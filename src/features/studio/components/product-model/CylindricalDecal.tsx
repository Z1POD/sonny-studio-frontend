// src/features/studio/components/product-model/CylindricalDecal.tsx

import { useMemo } from "react";
import * as THREE from "three";
import type { ArtworkState, PrintArea } from "../../store";
import { computeCylindricalZoneWindow } from "../../hooks/useDecalTransforms";
import { useWrapArtworkTexture } from "../../hooks/useWrapArtworkTexture";

interface CylindricalDecalProps {
  zone: PrintArea;
  artwork: ArtworkState;
  meshNode: THREE.Mesh;
  stackIndex?: number;
  isActive?: boolean;
  onSelect?: (zoneId: string) => void;
  /** false = read-only preview (marketplace): no click-to-select. Defaults
   *  to true (Studio). */
  editable?: boolean;
}

function wrapToPi(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Crops the mesh down to just the triangles inside the zone's angular/
 * height window, with UV remapped to a local 0..1 space centred on the
 * zone itself — so the window never straddles the atan2 branch cut no
 * matter where on the object the zone actually sits (including a "back"
 * zone, which in absolute mesh-space angle would otherwise land right at
 * the seam).
 */
function useCroppedCylindricalGeometry(
  meshNode: THREE.Mesh,
  zone: PrintArea,
): THREE.BufferGeometry | null {
  return useMemo(() => {
    const win = computeCylindricalZoneWindow(zone, meshNode);
    if (!win) return null;

    const source = meshNode.geometry.index ? meshNode.geometry.toNonIndexed() : meshNode.geometry;
    const position = source.attributes.position;
    const normalAttr = source.attributes.normal;
    const vertexCount = position.count;

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    const pointUv = (i: number): [number, number, boolean] => {
      const x = position.getX(i) - win.meshCenterX;
      const y = position.getY(i);
      const z = position.getZ(i) - win.meshCenterZ;
      const angle = Math.atan2(x, z);
      const relAngle = wrapToPi(angle - win.centerAngle);
      const u = 0.5 + relAngle / (2 * win.halfAngle);
      // Top of the window → v=0, matching the flipY=false convention
      // useWrapArtworkTexture already sets (see WrapOverlayMesh for the
      // same reasoning re: upside-down artwork).
      const v = 0.5 - (y - win.centerY) / (2 * win.halfHeight);
      const inside = u >= 0 && u <= 1 && v >= 0 && v <= 1;
      return [u, v, inside];
    };

    for (let t = 0; t < vertexCount; t += 3) {
      const a = pointUv(t);
      const b = pointUv(t + 1);
      const c = pointUv(t + 2);
      // Strict inclusion — only keep triangles fully inside the zone's
      // window, so the cropped patch's boundary tracks the print area's
      // actual footprint instead of bleeding past it.
      if (!a[2] || !b[2] || !c[2]) continue;

      for (const [idx, uvPoint] of [
        [t, a],
        [t + 1, b],
        [t + 2, c],
      ] as const) {
        positions.push(position.getX(idx), position.getY(idx), position.getZ(idx));
        if (normalAttr) {
          normals.push(normalAttr.getX(idx), normalAttr.getY(idx), normalAttr.getZ(idx));
        }
        uvs.push(uvPoint[0], uvPoint[1]);
      }
    }

    if (positions.length === 0) return null;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    if (normalAttr) {
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    } else {
      geometry.computeVertexNormals();
    }
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    return geometry;
  }, [meshNode, zone]);
}

export function CylindricalDecal({
  zone,
  artwork,
  meshNode,
  stackIndex = 0,
  isActive = false,
  onSelect,
  editable = true,
}: CylindricalDecalProps) {
  const geometry = useCroppedCylindricalGeometry(meshNode, zone);
  // Own dedicated texture instance (not the shared drei useTexture cache) —
  // same reasoning as the full-wrap path: this mutates wrapS/repeat/offset
  // on the texture, which must not be shared with any other usage of the
  // same image URL.
  const texture = useWrapArtworkTexture(artwork);

  if (!geometry || !texture) return null;

  return (
    <mesh
      geometry={geometry}
      renderOrder={stackIndex + 1}
      onClick={
        editable && onSelect
          ? (e: any) => {
              e.stopPropagation();
              onSelect(zone.id);
            }
          : undefined
      }
    >
      <meshStandardMaterial
        map={texture}
        transparent
        alphaTest={0.02}
        depthTest
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-4 - stackIndex}
        polygonOffsetUnits={-4 - stackIndex}
        roughness={0.9}
        metalness={0}
        side={THREE.DoubleSide}
        emissive={isActive ? new THREE.Color("#2f5fe0") : undefined}
        emissiveIntensity={isActive ? 0.12 : 0}
      />
    </mesh>
  );
}