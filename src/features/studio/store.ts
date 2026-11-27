import { create } from "zustand";
import { DEFAULT_STUDIO_BACKGROUND } from "./contract";
import { resolveZoneMethod } from "./lib/zone-method";
import type {
  ImageLayer,
  Layer,
  LayerTransform,
  PanelId,
  PrintMethodId,
  ProductConfig,
  StudioMode,
  TextLayer,
  ZoneId,
} from "./types";

const uid = () => Math.random().toString(36).slice(2, 10);

/** Perceived brightness 0..1 of a #rrggbb colour. */
function luminance(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

const defaultTransform = (): LayerTransform => ({ x: 0, y: 0, scale: 0.4, rotation: 0, opacity: 1 });

interface StudioState {
  product: ProductConfig | null;
  mode: StudioMode;
  colorId: string;
  activeZone: ZoneId;
  printMethod: PrintMethodId;
  /** Method picked per print zone (zone id → method id); zones without a pick use the default. */
  zoneMethods: Record<string, PrintMethodId>;
  layers: Layer[];
  selectedId: string | null;
  panel: PanelId;
  cameraFocus: number; // bump to re-focus camera on the active zone
  saving: boolean;
  /** Blocking progress while saving: which step is running. Null = idle. */
  saveStep: SaveStep | null;
  /** The 3D model / textures are still loading. */
  modelLoading: boolean;
  /** The canvas crashed or lost its GL context; the studio shows the error overlay. */
  canvasError: string | null;
  bgColor: string | null;
  autoRotate: boolean;
  setAutoRotate: (v: boolean) => void;
  setBgColor: (c: string | null) => void;
  /** Design persisted earlier in this session: re-saving updates it instead of creating a duplicate. */
  designId: string | null;
  /** Listing visibility sent on save (private = share-link only after approval). */
  isPrivate: boolean;
  setPrivate: (v: boolean) => void;
  setDesignId: (id: string | null) => void;

  load: (p: ProductConfig, opts?: { colorId?: string }) => void;
  setMode: (m: StudioMode) => void;
  setColor: (id: string) => void;
  setZone: (z: ZoneId) => void;
  setPrintMethod: (m: PrintMethodId) => void;
  setZoneMethod: (zoneId: string, m: PrintMethodId) => void;
  setPanel: (p: PanelId) => void;
  togglePanel: (p: Exclude<PanelId, null>) => void;
  select: (id: string | null) => void;
  adjustLayer: (id: string) => void;
  addText: () => void;
  addImage: (
    item: Pick<ImageLayer, "name" | "src"> & {
      category: ImageLayer["kind"];
      artworkId?: string;
      assetId?: string;
      uploading?: boolean;
    },
  ) => string;
  updateLayer: (id: string, patch: Partial<Layer>) => void;
  updateTransform: (id: string, patch: Partial<LayerTransform>) => void;
  removeLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  moveLayer: (id: string, dir: "up" | "down") => void;
  setSaving: (s: boolean) => void;
  setSaveStep: (s: SaveStep | null) => void;
  setModelLoading: (b: boolean) => void;
  setCanvasError: (m: string | null) => void;
}

export const useStudio = create<StudioState>((set, get) => ({
  product: null,
  mode: "edit",
  colorId: "",
  activeZone: "front",
  printMethod: "dtg",
  zoneMethods: {},
  layers: [],
  selectedId: null,
  panel: null,
  cameraFocus: 0,
  saving: false,
  saveStep: null,
  modelLoading: false,
  canvasError: null,
  bgColor: null,
  autoRotate: true,
  setAutoRotate: (autoRotate) => set({ autoRotate }),
  setBgColor: (bgColor) => set({ bgColor }),
  designId: null,
  setDesignId: (designId) => set({ designId }),
  isPrivate: false,
  setPrivate: (isPrivate) => set({ isPrivate }),

  load: (p, opts) => {
    const preferred = opts?.colorId ? p.colors.find((c) => c.id === opts.colorId && c.inStock) : undefined;
    const firstZone = p.initialLayers[0] ? p.printZones.find((z) => z.id === p.initialLayers[0]!.zoneId) : undefined;
    const activeZone = (firstZone ?? p.printZones[0])?.id ?? "";
    const zone = p.printZones.find((z) => z.id === activeZone);
    const method =
      zone && !zone.allowedMethods.includes(p.defaultPrintMethodId)
        ? (zone.allowedMethods[0] ?? p.defaultPrintMethodId)
        : p.defaultPrintMethodId;
    set({
      product: p,
      mode: "edit",
      panel: null,
      colorId: preferred?.id ?? p.defaultColorId,
      layers: p.initialLayers,
      activeZone,
      printMethod: method,
      zoneMethods: {},
      selectedId: p.initialLayers[0]?.id ?? null,
      bgColor: p.background ?? DEFAULT_STUDIO_BACKGROUND,
      designId: p.editingDesignId,
      saving: false,
      saveStep: null,
      canvasError: null,
    });
  },
  setMode: (mode) => set({ mode, panel: null, selectedId: mode === "preview" ? null : get().selectedId }),
  setColor: (colorId) => set({ colorId }),
  setZone: (activeZone) => {
    const { printMethod, product, zoneMethods } = get();
    const zone = product?.printZones.find((z) => z.id === activeZone);
    set({
      activeZone,
      cameraFocus: get().cameraFocus + 1,
      printMethod: zone ? resolveZoneMethod(zone, zoneMethods, printMethod) : printMethod,
    });
  },
  setPrintMethod: (printMethod) => set({ printMethod }),
  setZoneMethod: (zoneId, method) => {
    const next = { ...get().zoneMethods, [zoneId]: method };
    set({ zoneMethods: next, ...(get().activeZone === zoneId ? { printMethod: method } : {}) });
  },
  setPanel: (panel) => set({ panel }),
  togglePanel: (p) => set({ panel: get().panel === p ? null : p }),
  select: (selectedId) => {
    const layer = get().layers.find((l) => l.id === selectedId);
    if (layer && layer.zoneId !== get().activeZone) get().setZone(layer.zoneId);
    set({ selectedId });
  },
  adjustLayer: (id) => {
    const layer = get().layers.find((l) => l.id === id && l.visible && l.transform.opacity > 0);
    if (!layer) return;
    get().setZone(layer.zoneId);
    set({ selectedId: id, panel: "adjust", mode: "edit" });
  },
  addText: () => {
    if (get().product && !get().product!.editor.artworkAllowed.text) return; // policy: text is off for this product
    const layer: TextLayer = {
      id: uid(),
      kind: "text",
      name: "Text",
      zoneId: get().activeZone,
      visible: true,
      locked: false,
      transform: { ...defaultTransform(), scale: 0.25 },
      text: "Your text",
      fontFamily: get().product?.editor.fonts[0]?.family ?? "sans-serif",
      fontWeight: 700,
      color: luminance(selectColor(get())?.hex ?? "#ffffff") < 0.45 ? "#ffffff" : "#111111",
      letterSpacing: 0,
      align: "center",
      italic: false,
    };
    set({ layers: [...get().layers, layer], selectedId: layer.id, panel: "text" });
  },
  addImage: (item) => {
    const id = uid();
    const layer: ImageLayer = {
      id,
      kind: item.category,
      name: item.name,
      src: item.src,
      zoneId: get().activeZone,
      visible: true,
      locked: false,
      transform: defaultTransform(),
      ...(item.artworkId ? { artworkId: item.artworkId } : {}),
      ...(item.assetId ? { assetId: item.assetId } : {}),
      ...(item.uploading ? { uploading: true } : {}),
    };
    set({ layers: [...get().layers, layer], selectedId: id });
    return id;
  },
  updateLayer: (id, patch) =>
    set({ layers: get().layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)) }),
  updateTransform: (id, patch) =>
    set({
      layers: get().layers.map((l) => (l.id === id ? { ...l, transform: { ...l.transform, ...patch } } : l)),
    }),
  removeLayer: (id) =>
    set({
      layers: get().layers.filter((l) => l.id !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
    }),
  duplicateLayer: (id) => {
    const src = get().layers.find((l) => l.id === id);
    if (!src) return;
    const copy = {
      ...src,
      id: uid(),
      name: `${src.name} copy`,
      transform: { ...src.transform, x: Math.min(1, src.transform.x + 0.1), y: Math.max(-1, src.transform.y - 0.1) },
    } as Layer;
    const idx = get().layers.indexOf(src);
    const layers = [...get().layers];
    layers.splice(idx + 1, 0, copy);
    set({ layers, selectedId: copy.id });
  },
  moveLayer: (id, dir) => {
    const layers = [...get().layers];
    const i = layers.findIndex((l) => l.id === id);
    const j = dir === "up" ? i + 1 : i - 1;
    if (i < 0 || j < 0 || j >= layers.length) return;
    [layers[i], layers[j]] = [layers[j]!, layers[i]!];
    set({ layers });
  },
  setSaving: (saving) => set({ saving }),
  setSaveStep: (saveStep) => set({ saveStep }),
  setModelLoading: (modelLoading) => set({ modelLoading }),
  setCanvasError: (canvasError) => set({ canvasError }),
}));

export type SaveStep = "validate" | "capture" | "upload" | "save";

export const selectSelectedLayer = (s: StudioState) => s.layers.find((l) => l.id === s.selectedId) ?? null;
export const selectColor = (s: StudioState) => s.product?.colors.find((c) => c.id === s.colorId);
