import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { ModelAsset, PrintZone } from "../types";

/** Clone instances, not cached geometry/textures; preserve hierarchy and skeletons. */
export function prepareProductModel(source: THREE.Object3D, config: ModelAsset) {
  const scene = clone(source);
  const meshes: THREE.Mesh[] = [];
  const materials: THREE.Material[] = [];
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    meshes.push(object);
    const copy = (material: THREE.Material) => {
      // Fabric sheen needs a physical material; upgrade plain standard ones when the backend asks for sheen.
      let instance: THREE.Material;
      if (config.material?.sheen != null && material instanceof THREE.MeshStandardMaterial && !(material instanceof THREE.MeshPhysicalMaterial)) {
        const phys = new THREE.MeshPhysicalMaterial();
        THREE.MeshStandardMaterial.prototype.copy.call(phys, material);
        instance = phys;
      } else {
        instance = material.clone();
      }
      materials.push(instance);
      return instance;
    };
    object.material = Array.isArray(object.material) ? object.material.map(copy) : copy(object.material);
  });
  const names = config.printableMeshNodes ?? (config.meshNode ? [config.meshNode] : null);
  const printable = meshes.filter((mesh) => !names || names.includes(mesh.name));
  console.log("[ MODEL DEtail ]", {meshes})
  if (printable.length === 0) throw new Error("This product has no configured printable meshes");
  return { scene, meshes, printable, materials };
}

export function zoneTargetsMesh(zone: PrintZone, meshName: string, defaultMeshName: string) {
  return zone.meshNode ? zone.meshNode === meshName : zone.kind === "wrap" || meshName === defaultMeshName;
}