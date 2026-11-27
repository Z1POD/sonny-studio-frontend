import { Billboard, Decal, useGLTF } from "@react-three/drei";
import { createPortal, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { drawWrap, imageTexture, textTexture, zoneGuideTexture, type LayerTexture } from "../lib/textures";
import { textureHasInk, sourceHasInk, wrapLayerPoint } from "../lib/picking";
import { prepareProductModel, zoneTargetsMesh } from "../lib/product-model";
import { useStudio, selectColor } from "../store";
import { useTheme } from "@/shared/stores/theme-store";
import type { Layer, ModelAsset, PrintZone } from "../types";

/** What the 3D model needs to render prints; satisfied by both the studio config and the product-page viewer. */
export interface ModelViewProps {
  model: ModelAsset;
  printZones: PrintZone[];
  layers: Layer[];
  /** Garment colour (hex). Undefined keeps the model's authored material colour. */
  colorHex?: string;
  /** Edit mode shows the active zone's guide and lets the user drag / resize / rotate prints on the model; preview is read-only. */
  mode?: "edit" | "preview";
  activeZone?: string;
  /** Layer currently selected in the studio (edit mode draws its frame + handles). */
  selectedId?: string | null;
  /** Called when a printed layer is double-clicked (studio: opens Adjust). Omit for read-only views. */
  onPickLayer?: (layerId: string) => void;
}

function useLayerTexture(layer: Layer) {
  const [tex, setTex] = useState<LayerTexture | null>(null);
  const key = layer.kind === "text"
    ? JSON.stringify([layer.text, layer.fontFamily, layer.fontWeight, layer.color, layer.letterSpacing, layer.align, layer.italic])
    : layer.src;
  useEffect(() => {
    let alive = true;
    let current: LayerTexture | null = null;
    setTex(null);
    const ready = (t: LayerTexture) => {
      if (!alive) { t.texture.dispose(); return; }
      current = t;
      setTex(t);
    };
    if (layer.kind === "text") ready(textTexture(layer));
    else imageTexture(layer).then(ready).catch(() => undefined);
    return () => { alive = false; current?.texture.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return tex;
}

function placement(zone: PrintZone, layer: Layer, aspect: number) {
  const { x, y, scale, rotation } = layer.transform;
  const zoneQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(...zone.rotation));
  const offset = new THREE.Vector3(x * zone.size[0] / 2, y * zone.size[1] / 2, 0).applyQuaternion(zoneQ);
  const pos = new THREE.Vector3(...zone.position).add(offset);
  const rotQ = zoneQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -rotation * Math.PI / 180));
  const h = scale * zone.size[1];
  return { pos, rot: new THREE.Euler().setFromQuaternion(rotQ), scale: new THREE.Vector3(h * aspect, h, zone.projectionDepth ?? 0.14) };
}

function LayerDecal({ layer, zone, order }: { layer: Layer; zone: PrintZone; order: number }) {
  const tex = useLayerTexture(layer);
  if (!tex || !layer.visible || layer.transform.opacity <= 0) return null;
  const p = placement(zone, layer, tex.aspect);
  return (
    <Decal position={p.pos} rotation={p.rot} scale={p.scale} userData={{ layerId: layer.id }} renderOrder={order + 1}>
      <meshStandardMaterial map={tex.texture} transparent opacity={layer.transform.opacity}
        roughness={layer.kind === "text" ? 0.9 : 0.75} polygonOffset polygonOffsetFactor={-4 - order}
        depthTest depthWrite={false} />
    </Decal>
  );
}

type HandleKind = "scale" | "rotate" | "delete";
type StartHandle = (kind: HandleKind, layer: Layer, zone: PrintZone, mesh: THREE.Mesh, aspect: number) => void;

function frameTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.strokeStyle = "#0a84ff";
  g.lineWidth = 10;
  g.strokeRect(5, 5, 502, 502);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Circular badge with the same resize / rotate glyphs the Adjust board uses, tinted from the live theme tokens. */
function handleTexture(kind: HandleKind): THREE.CanvasTexture {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  const bg = v("--background", "#ffffff");
  const fg = v("--foreground", "#1a1a1a");
  const edge = v("--border-strong", "rgba(0,0,0,0.2)");
  const S = 128;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.beginPath();
  g.arc(S / 2, S / 2, 58, 0, Math.PI * 2);
  g.fillStyle = kind === "delete" ? "#e5484d" : bg;
  g.fill();
  g.lineWidth = 5;
  g.strokeStyle = edge;
  g.stroke();
  const s = 2.1; // 24px lucide glyph scaled to ~50px inside the 116px badge
  g.save();
  g.translate(S / 2 - 12 * s, S / 2 - 12 * s);
  g.scale(s, s);
  g.lineWidth = 2;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = kind === "delete" ? "#ffffff" : fg;
  const paths = kind === "rotate"
    ? ["M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 12", "M21 3v9h-9"]
    : kind === "delete"
      ? ["M18 6 6 18", "m6 6 12 12"]
      : ["M15 3h6v6", "M9 21H3v-6", "M21 3 3 21", "M3 3l18 18"];
  for (const d of paths) g.stroke(new Path2D(d));
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Border plus resize (corner) and rotate (top) handles drawn on the selected print, like the Adjust board. */
function SelectionFrame({ layer, zone, mesh, onHandle }: { layer: Layer; zone: PrintZone; mesh: THREE.Mesh; onHandle: StartHandle }) {
  const tex = useLayerTexture(layer);
  const theme = useTheme((s) => s.mode);
  const frame = useMemo(() => frameTexture(), []);
  const icons = useMemo(() => ({ scale: handleTexture("scale"), rotate: handleTexture("rotate"), delete: handleTexture("delete") }), [theme]);
  useEffect(() => () => frame.dispose(), [frame]);
  useEffect(() => () => { icons.scale.dispose(); icons.rotate.dispose(); icons.delete.dispose(); }, [icons]);
  if (!tex || !layer.visible) return null;
  const p = placement(zone, layer, tex.aspect);
  const q = new THREE.Quaternion().setFromEuler(p.rot);
  const w = p.scale.x, h = p.scale.y;
  const lift = new THREE.Vector3(0, 0, 0.02).applyQuaternion(q);
  const at = (x: number, y: number) => new THREE.Vector3(x, y, 0).applyQuaternion(q).add(p.pos).add(lift);
  const HS = 0.038;
  const handle = (kind: HandleKind, pos: THREE.Vector3) => (
    <Billboard position={pos} userData={{ guide: true }}>
      <mesh renderOrder={999} userData={{ handle: kind }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          if (kind === "delete") {
            document.body.style.cursor = "";
            useStudio.getState().removeLayer(layer.id);
            return;
          }
          onHandle(kind, layer, zone, mesh, tex.aspect);
        }}
        onPointerOver={() => { document.body.style.cursor = kind === "scale" ? "nwse-resize" : kind === "delete" ? "pointer" : "grab"; }}
        onPointerOut={() => { document.body.style.cursor = ""; }}>
        <planeGeometry args={[HS, HS]} />
        <meshBasicMaterial map={icons[kind]} transparent depthTest={false} toneMapped={false} />
      </mesh>
    </Billboard>
  );
  return (
    <>
      <Decal position={p.pos} rotation={p.rot} scale={[w * 1.04, h * 1.04, p.scale.z]} raycast={() => undefined} userData={{ guide: true }}>
        <meshBasicMaterial map={frame} transparent polygonOffset polygonOffsetFactor={-30} depthWrite={false} />
      </Decal>
      {handle("scale", at(w / 2, -h / 2))}
      {handle("rotate", at(0, h / 2 + HS * 0.75))}
      {handle("delete", at(-w / 2, -h / 2))}
    </>
  );
}

function ZoneGuide({ zone }: { zone: PrintZone }) {
  const tex = useMemo(() => zoneGuideTexture(), []);
  useEffect(() => () => tex.texture.dispose(), [tex]);
  return (
    <Decal position={zone.position} rotation={zone.rotation}
      scale={[zone.size[0], zone.size[1], zone.projectionDepth ?? 0.14]} userData={{ guide: true }} raycast={() => undefined}>
      <meshBasicMaterial map={tex.texture} transparent polygonOffset polygonOffsetFactor={-20} depthWrite={false} />
    </Decal>
  );
}

export function ProductModelView({ model, printZones, layers, colorHex, mode = "preview", activeZone, selectedId = null, onPickLayer }: ModelViewProps) {
  const product = { model, printZones };
  const color = colorHex ? { hex: colorHex } : undefined;
  const { scene: source } = useGLTF(product.model.url);
  const instance = useMemo(() => prepareProductModel(source, product.model), [source, product.model]);
  const surfaces = useMemo(() => instance.printable.map((mesh) => {
    const standard = (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
      .filter((m): m is THREE.MeshStandardMaterial => m instanceof THREE.MeshStandardMaterial);
    // Match the configured material name; when nothing on this mesh carries it (names differ between the DCC export
    // and the backend, or the model has several meshes with their own materials) fall back to every standard
    // material on the mesh so colour and textures are never silently skipped.
    const named = product.model.materialName ? standard.filter((m) => m.name === product.model.materialName) : standard;
    const materials = named.length ? named : standard;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 2048;
    const texture = new THREE.CanvasTexture(canvas);
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return { mesh, materials: materials.map((m) => ({ material: m, map: m.map, color: m.color.clone() })), canvas, texture,
      sources: [] as (HTMLCanvasElement | HTMLImageElement | null)[], layers: [] as Layer[], wrapped: false };
  }), [instance, product.model.materialName]);
  // Backend-provided surface tuning (roughness, metalness, env reflections, texture maps). Missing fields keep the
  // model's own material; a texture that fails to load is skipped rather than breaking the studio.
  const tuning = product.model.material;
  useEffect(() => {
    let alive = true;
    const loaded: THREE.Texture[] = [];
    for (const s of surfaces) {
      for (const entry of s.materials) {
        const mm = entry.material;
        // Matte cloth by default; the backend can override any of it.
        mm.roughness = tuning?.roughness ?? 0.92;
        mm.metalness = tuning?.metalness ?? 0;
        if (tuning?.envMapIntensity != null) mm.envMapIntensity = tuning.envMapIntensity;
        if ("sheen" in mm) {
          const phys = mm as THREE.MeshPhysicalMaterial;
          phys.sheen = tuning?.sheen ?? 0.85;
          phys.sheenRoughness = tuning?.sheenRoughness ?? 0.75;
          if (tuning?.sheenColor) phys.sheenColor.set(tuning.sheenColor);
        }
        mm.needsUpdate = true;
      }
    }
    if (!tuning) return () => { alive = false; };
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    const load = (url: string | undefined, srgb: boolean, assign: (t: THREE.Texture, entry: (typeof surfaces)[number]["materials"][number], surface: (typeof surfaces)[number]) => void) => {
      if (!url) return;
      loader.load(url, (tex) => {
        if (!alive) { tex.dispose(); return; }
        tex.flipY = false; // glTF UV convention
        tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(tuning.repeat?.[0] ?? 1, tuning.repeat?.[1] ?? 1);
        tex.anisotropy = 8;
        loaded.push(tex);
        for (const s of surfaces) for (const entry of s.materials) { assign(tex, entry, s); entry.material.needsUpdate = true; }
      }, undefined, () => { /* ignore a missing map */ });
    };
    load(tuning.maps?.map, true, (t, entry, s) => { entry.map = t; if (!s.wrapped) entry.material.map = t; });
    load(tuning.maps?.normalMap, false, (t, entry) => { entry.material.normalMap = t; });
    load(tuning.maps?.roughnessMap, false, (t, entry) => { entry.material.roughnessMap = t; });
    load(tuning.maps?.aoMap, false, (t, entry) => { entry.material.aoMap = t; });
    return () => { alive = false; loaded.forEach((t) => t.dispose()); };
  }, [surfaces, tuning]);
  const wrapKey = JSON.stringify(layers.filter((l) => product.printZones.some((z) => z.id === l.zoneId && z.kind === "wrap"))) + color?.hex;
  useEffect(() => {
    let alive = true;
    for (const surface of surfaces) {
      const wrapLayers = layers.filter((l) => l.visible && product.printZones.some((z) => z.id === l.zoneId && z.kind === "wrap" && zoneTargetsMesh(z, surface.mesh.name, instance.printable[0]?.name ?? "")));
      if (!wrapLayers.length) {
        surface.wrapped = false;
        surface.layers = [];
        surface.materials.forEach(({ material, map }) => { material.map = map; material.needsUpdate = true; });
        continue;
      }
      // Draw offscreen so superseded async requests cannot overwrite the displayed map.
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = surface.canvas.width;
      drawWrap(canvas, wrapLayers, color?.hex ?? surface.materials[0]?.color.getStyle() ?? "#ffffff").then((sources) => {
        if (!alive) return;
        surface.canvas.getContext("2d")?.drawImage(canvas, 0, 0);
        surface.texture.needsUpdate = true;
        surface.sources = sources;
        surface.layers = wrapLayers;
        surface.wrapped = true;
        surface.materials.forEach(({ material }) => { material.map = surface.texture; material.needsUpdate = true; });
      });
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrapKey, surfaces]);
  useEffect(() => () => {
    surfaces.forEach((s) => s.texture.dispose());
    instance.materials.forEach((m) => m.dispose());
  }, [surfaces, instance]);
  const target = useMemo(() => new THREE.Color(), []);
  const white = useMemo(() => new THREE.Color("#ffffff"), []);
  const sheenTarget = useMemo(() => new THREE.Color(), []);
  useFrame((_, delta) => {
    const k = 1 - Math.exp(-8 * Math.min(delta, 0.05));
    surfaces.forEach((s) => s.materials.forEach(({ material, color: original }) => {
      if (s.wrapped) target.setRGB(1, 1, 1);
      else if (color) target.set(color.hex);
      else target.copy(original);
      material.color.lerp(target, k);
      // Without an explicit sheen colour, tint the sheen from the fabric colour, slightly toward white.
      if (!tuning?.sheenColor && "sheenColor" in material) {
        sheenTarget.copy(material.color).lerp(white, 0.25);
        (material as THREE.MeshPhysicalMaterial).sheenColor.copy(sheenTarget);
      }
    }));
  });

  type Pick = { id: string; mesh: THREE.Mesh; point: THREE.Vector3; uv: THREE.Vector2 | null; wrap: boolean };
  function pickLayer(event: ThreeEvent<PointerEvent | MouseEvent>): Pick | null {
    const hits = event.intersections;
    const nearestSurface = hits.find((h) => instance.meshes.includes(h.object as THREE.Mesh));
    if (!nearestSurface) return null;
    const surfaceMesh = nearestSurface.object as THREE.Mesh;
    // Offset decals share the underlying surface; reject prints through other parts.
    const candidates = hits.filter((h) => h.distance <= nearestSurface.distance + 0.02 && h.object.userData["layerId"])
      .sort((a, b) => layers.findIndex((l) => l.id === b.object.userData["layerId"]) - layers.findIndex((l) => l.id === a.object.userData["layerId"]));
    for (const hit of candidates) {
      if (!(hit.object instanceof THREE.Mesh) || !hit.uv) continue;
      const material = hit.object.material;
      if (material instanceof THREE.MeshStandardMaterial && material.map && textureHasInk(material.map, hit.uv)) {
        return { id: hit.object.userData["layerId"], mesh: surfaceMesh, point: hit.point, uv: null, wrap: false };
      }
    }
    const surface = surfaces.find((s) => s.mesh === surfaceMesh);
    if (!surface?.wrapped || !nearestSurface.uv) return null;
    const uv = nearestSurface.uv.clone();
    surface.texture.transformUv(uv);
    for (let i = surface.layers.length - 1; i >= 0; i--) {
      const layer = surface.layers[i];
      const source = surface.sources[i];
      if (!layer || !source || layer.transform.opacity <= 0) continue;
      const w = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
      const h = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
      if (!sourceHasInk(source, ...Object.values(wrapLayerPoint(layer, uv, w / h)) as [number, number])) continue;
      return { id: layer.id, mesh: surfaceMesh, point: nearestSurface.point, uv, wrap: true };
    }
    return null;
  }

  function doubleClick(event: ThreeEvent<MouseEvent>) {
    const hit = pickLayer(event);
    if (!hit) return;
    event.stopPropagation();
    onPickLayer?.(hit.id);
  }

  /** Zone-normalised (-1..1) coordinates of a mesh-surface world point. */
  function zoneCoords(zone: PrintZone, mesh: THREE.Mesh, world: THREE.Vector3) {
    const local = mesh.worldToLocal(world.clone()).sub(new THREE.Vector3(...zone.position));
    local.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(...zone.rotation)).invert());
    return { x: local.x / (zone.size[0] / 2), y: local.y / (zone.size[1] / 2) };
  }

  const drag = useRef<{ id: string; zone: PrintZone; mesh: THREE.Mesh; wrap: boolean; dx: number; dy: number; kind?: HandleKind; aspect?: number } | null>(null);
  const startHandle: StartHandle = (kind, layer, zone, mesh, aspect) => {
    if (layer.locked) return;
    drag.current = { id: layer.id, zone, mesh, wrap: false, dx: 0, dy: 0, kind, aspect };
    if (controls) controls.enabled = false;
    document.body.style.cursor = kind === "scale" ? "nwse-resize" : "grabbing";
  };
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  useEffect(() => {
    const end = () => {
      if (!drag.current) return;
      drag.current = null;
      if (controls) controls.enabled = true;
      document.body.style.cursor = "";
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => { window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end); };
  }, [controls]);

  function pointerDown(event: ThreeEvent<PointerEvent>) {
    if (mode !== "edit" || event.button !== 0) return;
    const hit = pickLayer(event);
    const layer = hit && layers.find((l) => l.id === hit.id);
    const zone = layer && product.printZones.find((z) => z.id === layer.zoneId);
    if (!hit || !layer || !zone || layer.locked) {
      // Pressing the model (or a locked layer) away from the selected artwork clears the selection.
      if (!hit) useStudio.getState().select(null);
      return;
    }
    event.stopPropagation();
    const st = useStudio.getState();
    if (st.selectedId !== layer.id) st.select(layer.id);
    const at = hit.wrap && hit.uv ? { x: hit.uv.x * 2 - 1, y: 1 - hit.uv.y * 2 } : zoneCoords(zone, hit.mesh, hit.point);
    drag.current = { id: layer.id, zone, mesh: hit.mesh, wrap: hit.wrap, dx: layer.transform.x - at.x, dy: layer.transform.y - at.y };
    if (controls) controls.enabled = false;
    document.body.style.cursor = "grabbing";
  }

  function pointerMove(event: ThreeEvent<PointerEvent>) {
    const d = drag.current;
    if (!d) return;
    const hit = event.intersections.find((h) => h.object === d.mesh);
    if (!hit) return;
    event.stopPropagation();
    let at: { x: number; y: number };
    if (d.wrap) {
      if (!hit.uv) return;
      const uv = hit.uv.clone();
      surfaces.find((s) => s.mesh === d.mesh)?.texture.transformUv(uv);
      at = { x: uv.x * 2 - 1, y: 1 - uv.y * 2 };
    } else at = zoneCoords(d.zone, d.mesh, hit.point);
    if (d.kind) {
      const layer = useStudio.getState().layers.find((l) => l.id === d.id);
      if (!layer) return;
      const [zw, zh] = d.zone.size;
      const mx = (at.x - layer.transform.x) * zw / 2, my = (at.y - layer.transform.y) * zh / 2;
      if (d.kind === "scale") {
        const a = d.aspect ?? 1;
        const scale = (2 * Math.hypot(mx, my)) / (zh * Math.hypot(a, 1));
        useStudio.getState().updateTransform(d.id, { scale: +Math.max(0.05, Math.min(2, scale)).toFixed(3) });
      } else {
        let deg = 90 - Math.atan2(my, mx) * 180 / Math.PI;
        if (event.shiftKey) deg = Math.round(deg / 15) * 15;
        deg = ((deg + 540) % 360) - 180;
        useStudio.getState().updateTransform(d.id, { rotation: Math.round(deg) });
      }
      return;
    }
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    useStudio.getState().updateTransform(d.id, { x: +clamp(at.x + d.dx).toFixed(3), y: +clamp(at.y + d.dy).toFixed(3) });
  }

  const guideZone = mode === "edit" ? product.printZones.find((z) => z.id === activeZone && z.kind === "decal") : undefined;
  const defaultMesh = instance.printable[0]?.name ?? "";
  return (
    <group position={product.model.position} scale={product.model.scale} rotation={product.model.rotation ?? [0, 0, 0]} onDoubleClick={doubleClick}
      onPointerDown={pointerDown} onPointerMove={pointerMove}>
      <primitive object={instance.scene} dispose={null} />
      {instance.printable.map((mesh) => <Fragment key={mesh.uuid}>{createPortal(<>
        {layers.map((layer, order) => {
          const zone = product.printZones.find((z) => z.id === layer.zoneId && z.kind === "decal" && zoneTargetsMesh(z, mesh.name, defaultMesh));
          return zone ? <LayerDecal key={layer.id} layer={layer} zone={zone} order={order} /> : null;
        })}
        {mode === "edit" && (() => {
          const sel = layers.find((l) => l.id === selectedId && !l.locked);
          const zone = sel && sel.zoneId === activeZone && product.printZones.find((z) => z.id === sel.zoneId && z.kind === "decal" && zoneTargetsMesh(z, mesh.name, defaultMesh));
          return sel && zone ? <SelectionFrame key={sel.id} layer={sel} zone={zone} mesh={mesh} onHandle={startHandle} /> : null;
        })()}
        {guideZone && zoneTargetsMesh(guideZone, mesh.name, defaultMesh) && <ZoneGuide zone={guideZone} />}
      </>, mesh)}</Fragment>)}
    </group>
  );
}

/** Product-agnostic GLTF renderer for the studio; the filename is retained for existing imports. */
export function Shirt() {
  const product = useStudio((s) => s.product);
  const layers = useStudio((s) => s.layers);
  const mode = useStudio((s) => s.mode);
  const activeZone = useStudio((s) => s.activeZone);
  const selectedId = useStudio((s) => s.selectedId);
  const color = useStudio(selectColor);
  if (!product) return null;
  return (
    <ProductModelView
      key={product.id + product.model.url}
      model={product.model}
      printZones={product.printZones}
      layers={layers}
      colorHex={color?.hex}
      mode={mode}
      activeZone={activeZone}
      selectedId={selectedId}
      onPickLayer={(id) => useStudio.getState().adjustLayer(id)}
    />
  );
}
