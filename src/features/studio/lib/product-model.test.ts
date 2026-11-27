import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { prepareProductModel, zoneTargetsMesh } from "./product-model";
import { mapStudioConfig } from "../contract";
import { RAW_DERIVED_LAYERS, RAW_STUDIO_CONFIG } from "../__fixtures__/studio-api.fixtures";
import { useStudio } from "../store";
import { wrapLayerPoint } from "./picking";

const MOCK_PRODUCT = mapStudioConfig({ ...RAW_STUDIO_CONFIG, initial_layers: RAW_DERIVED_LAYERS });

describe("Backend-configured product models", () => {
  it("preserves multipart hierarchy, transforms and nonprintable materials", () => {
    const source = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    body.name = "BottleBody";
    body.position.set(1, 2, 3);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    lid.name = "Lid";
    source.add(body, lid);
    const result = prepareProductModel(source, { url: "bottle.glb", format: "glb", scale: 1, position: [0, 0, 0], printableMeshNodes: ["BottleBody"] });
    expect(result.meshes).toHaveLength(2);
    expect(result.printable.map((m) => m.name)).toEqual(["BottleBody"]);
    expect(result.printable[0]?.position.toArray()).toEqual([1, 2, 3]);
    expect(result.printable[0]?.material).not.toBe(body.material);
    expect(result.scene.children).toHaveLength(2);
  });
  it("uses all meshes when no node names are specified", () => {
    const source = new THREE.Group();
    source.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    const result = prepareProductModel(source, { url: "mug.gltf", format: "gltf", scale: 1, position: [0, 0, 0] });
    expect(result.printable).toHaveLength(1);
  });
  it("targets custom print zones on their named model part", () => {
    const base = MOCK_PRODUCT.printZones[0];
    if (!base) throw new Error("Missing fixture");
    const zone = { ...base, id: "mug_side", meshNode: "Cup" };
    expect(zoneTargetsMesh(zone, "Cup", "Handle")).toBe(true);
    expect(zoneTargetsMesh(zone, "Handle", "Handle")).toBe(false);
  });
});

describe("Direct layer adjustment", () => {
  it("opens Adjust for the clicked layer and its available zone", () => {
    const layer = MOCK_PRODUCT.initialLayers[0];
    if (!layer) throw new Error("Missing fixture");
    useStudio.getState().load(MOCK_PRODUCT);
    useStudio.setState({ layers: [{ ...layer, id: "clicked", zoneId: "back" }], panel: "artwork", mode: "preview" });
    useStudio.getState().adjustLayer("clicked");
    expect(useStudio.getState().selectedId).toBe("clicked");
    expect(useStudio.getState().activeZone).toBe("back");
    expect(useStudio.getState().panel).toBe("adjust");
    expect(useStudio.getState().mode).toBe("edit");
  });
  it("does not select invisible artwork", () => {
    const layer = MOCK_PRODUCT.initialLayers[0];
    if (!layer) throw new Error("Missing fixture");
    useStudio.setState({ layers: [{ ...layer, id: "hidden", visible: false }], panel: null, selectedId: null });
    useStudio.getState().adjustLayer("hidden");
    expect(useStudio.getState().panel).toBeNull();
    expect(useStudio.getState().selectedId).toBeNull();
  });
  it("resolves a rotated wrap layer's center in UV space", () => {
    const layer = MOCK_PRODUCT.initialLayers[0];
    if (!layer) throw new Error("Missing fixture");
    const result = wrapLayerPoint({ ...layer, transform: { x: 0.4, y: -0.2, scale: 0.5, rotation: 90, opacity: 1 } }, { x: 0.7, y: 0.6 }, 2);
    expect(result.x).toBeCloseTo(0.5);
    expect(result.y).toBeCloseTo(0.5);
  });
});
describe("fabric sheen + multi-mesh", () => {
  it("keeps every printable mesh and upgrades standard materials to physical when sheen is configured", () => {
    const root = new THREE.Group();
    for (const name of ["Kit_1001", "Kit_1002", "Trim"]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: "lambert1" }));
      m.name = name;
      root.add(m);
    }
    const r = prepareProductModel(root, { url: "k.glb", format: "glb", scale: 1, position: [0, 0, 0], printableMeshNodes: ["Kit_1001", "Kit_1002"], material: { sheen: 0.8 } });
    expect(r.printable.map((m) => m.name)).toEqual(["Kit_1001", "Kit_1002"]);
    expect(r.printable.every((m) => m.material instanceof THREE.MeshPhysicalMaterial)).toBe(true);
  });
});
