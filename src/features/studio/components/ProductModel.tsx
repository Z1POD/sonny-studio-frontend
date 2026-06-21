import { Decal, useGLTF, useTexture } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import type { ArtworkState, PrintArea } from "../store";
import { 
  useDecalTransform, 
  computeDecalTransform, 
  FULL_PRINT_PLACEMENTS, 
  type DecalTransform } from "../hooks/useDecalTransforms";


// ─── DecalLayer ──────────────────────────────────────────────────

interface DecalLayerProps {
  artwork: ArtworkState;
  zone: PrintArea;
  meshNode: THREE.Mesh; // ← now required
}

// Replace DecalLayer in ProductModel.tsx

function DecalLayer({ artwork, zone, meshNode }: DecalLayerProps) {
  const texture = useTexture(artwork.decalUrl || "");

  useMemo(() => {
    if (!texture) return;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
  }, [texture]);

  if (!texture) return null;

  // Full/all-over print — one decal per surface face
  if (zone.placement === "full") {
    return (
      <FullPrintDecalLayer artwork={artwork} zone={zone} meshNode={meshNode} texture={texture} />
    );
  }

  return <SingleDecalLayer artwork={artwork} zone={zone} meshNode={meshNode} texture={texture} />;
}

function SingleDecalLayer({ artwork, zone, meshNode, texture }: DecalLayerProps & { texture: THREE.Texture }) {
  const transform = useDecalTransform(zone, artwork, meshNode);
  if (!transform) return null;
  return (
    <Decal position={transform.position} rotation={transform.rotation} scale={transform.scale}>
      <meshStandardMaterial
        map={texture}
        transparent alphaTest={0.02}
        depthTest depthWrite={false}
        polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4}
      />
    </Decal>
  );
}

function FullPrintDecalLayer({ artwork, zone, meshNode, texture }: DecalLayerProps & { texture: THREE.Texture }) {
  const transforms = useMemo(() =>
    FULL_PRINT_PLACEMENTS.map((placement) =>
      computeDecalTransform(zone, artwork, meshNode, placement)
    ).filter((t): t is DecalTransform => t !== null),
    [zone, artwork, meshNode],
  );

  return (
    <>
      {transforms.map((transform, i) => (
        <Decal key={i} position={transform.position} rotation={transform.rotation} scale={transform.scale}>
          <meshStandardMaterial
            map={texture}
            transparent alphaTest={0.02}
            depthTest depthWrite={false}
            polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4}
          />
        </Decal>
      ))}
    </>
  );
}

// ─── Material Builder ──────────────────────────────────────────

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
}: UseMaterialProps) {
  // Safe: pass empty string for null, drei's useTexture handles it

  const diffuse = materialConfig.textureUrl ? useTexture(materialConfig.textureUrl) : null;
  const normal = materialConfig.normalMapUrl ? useTexture(materialConfig.normalMapUrl) : null;

  return useMemo(() => {
    const isColorable =
      colorableMeshes.length === 0 ||
      colorableMeshes.some((n) =>
        node.name.toLowerCase().includes(n.toLowerCase()),
      );
 
    const hasTexture   = !!materialConfig?.textureUrl;
    const hasNormal    = !!materialConfig?.normalMapUrl;
    const hasColor     = isColorable && !!selectedColor;
 
    // ─── THE KEY: mirror the original MaterialApplier condition exactly ───
    // MaterialApplier only replaced the material when selectedColor was set
    // OR a texture/normalMap existed. When neither was true it did nothing,
    // leaving the GLB's baked lambert1 material completely untouched.
    // That's why the shirt looked like real cotton — no replacement happened.
    if (!hasColor && !hasTexture && !hasNormal) {
      return node.material as THREE.Material;
    }
 
    // One of the overrides is active — build a MeshStandardMaterial
    // exactly as MaterialApplier did (matching its constructor args).
    if (hasTexture) diffuse.colorSpace = THREE.SRGBColorSpace;
 
    return new THREE.MeshStandardMaterial({
      color:      hasColor   ? new THREE.Color(selectedColor!) : undefined,
      map:        hasTexture ? diffuse : null,
      normalMap:  hasNormal  ? normal  : null,
      roughness:  materialConfig?.roughness ?? 0.9,
      metalness:  materialConfig?.metalness ?? 0,
      side:       THREE.DoubleSide,
    });
  }, [node, selectedColor, colorableMeshes, materialConfig, diffuse, normal]);
}


// ─── Zone Filter ─────────────────────────────────────────────────

function zoneTargetsMesh(zone: PrintArea, meshName: string): boolean {
  if (!zone.meshName) return true;
  return meshName.toLowerCase().includes(zone.meshName.toLowerCase());
}

// ─── Main ProductModel ───────────────────────────────────────────

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
    () =>
      Object.values(nodes).filter(
        (n): n is THREE.Mesh => n instanceof THREE.Mesh,
      ),
    [nodes],
  );

  return (
    <group>
      {meshNodes.map((node) => {
        const material = useBuiltMaterial({
          node,
          selectedColor,
          colorableMeshes,
          materialConfig,
        });

        const zonesForMesh = printAreas.filter((z) =>
          zoneTargetsMesh(z, node.name),
        );

        return (
          <mesh
            key={node.uuid}
            castShadow
            receiveShadow
            geometry={node.geometry}
            material={material}
          >
            {zonesForMesh.map((zone) => {
              const art = artworks[zone.id];
              // Only render DecalLayer if artwork exists
              if (!art?.decalUrl) return null;
              return (
                <DecalLayer
                  key={zone.id}
                  artwork={art}
                  zone={zone}
                  meshNode={node} // ← PASS the actual mesh
                />
              );
            })}
          </mesh>
        );
      })}
    </group>
  );
}