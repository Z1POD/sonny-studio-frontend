import { create } from "zustand";

export type EnvironmentPreset =
  | "studio"
  | "city"
  | "sunset"
  | "warehouse"
  | "dawn";

export interface PricingTier {
  // id: string;
  sizeTier: string;
  printMethod: string;
  printMethodId?: string;
  printMethodName: string;
  maxWidthCm: number;
  maxHeightCm: number;
  currency: string;
  price: string;
  additionalColorPrice: string;
}


// Replace the PrintArea interface entirely

export interface PrintMethod {
  code: string;
  name: string;
  tiers: Array<{
    size: string;
    max_w: number;
    max_h: number;
    price: string;
    extra_color_price: string;
  }>;
}

export interface PrintArea {
  id: string;
  areaKey: string;
  name: string;
  placement: string;
  meshName: string;
  aspectRatio?: number;
  allowScaling: boolean;
  allowRotation: boolean;
  maxLayers: number;
  widthCm: number;
  heightCm: number;
  allowedFileTypes: string[];
  sortOrder?: number;
  currency?: { code: string; symbol: string };
  methods: PrintMethod[];              // ← replaces pricingTiers
  uvBounds?: {
    minU: number; minV: number; maxU: number; maxV: number;
  };
  worldBounds?: {
    center: [number, number, number];
    halfExtents: [number, number, number];
    rotation: [number, number, number];
  };
  transformLimits?: {
    minScale: number; maxScale: number;
    minX: number; maxX: number;
    minY: number; maxY: number;
  };
  cameraFocus?: {
    position: [number, number, number];
    target: [number, number, number];
  };
  previewImage?: string;
}

export interface MaterialConfig {
  textureUrl: string | null;
  normalMapUrl: string | null;
  roughness: number;
  metalness: number;
}

export interface RenderConfig {
  environment: EnvironmentPreset;
  background: string;
  modelPosition: [number, number, number];
  contactShadows: {
    enabled: boolean;
    position: [number, number, number];
    opacity: number;
    scale: number;
    blur: number;
    far: number;
  };
}

export interface OrbitConfig {
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
  enablePan: boolean;
  enableZoom: boolean;
}

export interface CameraConfig {
  position: [number, number, number];
  fov: number;
  orbit: OrbitConfig;
  captureDistanceScale?: number;
  captureLookAtOffset?: number;
}

export interface Variant {
  id: string;
  sku: string;
  color: { name: string; hex: string };
  size: string;
  stockQuantity: number;
  isInStock: boolean;
  additionalPrice: string;
}

export interface ApparelProduct {
  id: string;
  name: string;
  slug: string;
  description?: string;
  basePrice: string;
  currencySymbol: string;
  modelUrl: string;
  environment: EnvironmentPreset;
  cameraConfig: CameraConfig;
  renderConfig: RenderConfig;
  materialConfig: MaterialConfig;
  colors: string[];
  colorableMeshes: string[];
  printAreas: PrintArea[];
  variants: Variant[];
  defaultView?: string;
  studioCapabilities?: {
    allowText: boolean;
    allowImages: boolean;
    allowSvg: boolean;
    allowMultipleLayers: boolean;
    allowColorChange: boolean;
    allowArPreview: boolean;
  };
}

export interface ArtworkState {
  decalUrl: string;
  decalAspect: number;
  decalScale: number;
  decalRotation: number;
  decalOffsetX: number;
  decalOffsetY: number;
}

const DEFAULT_ARTWORK: ArtworkState = {
  decalUrl: "",
  decalAspect: 1,
  decalScale: 0.15,
  decalRotation: 0,
  decalOffsetX: 0,
  decalOffsetY: 0,
};

export function getDefaultArtwork(
  overrides?: Partial<ArtworkState>,
): ArtworkState {
  return { ...DEFAULT_ARTWORK, ...overrides };
}

export interface StudioState {
  product: ApparelProduct | null;
  selectedPrintAreaId: string | null;
  selectedColor: string | null;
  selectedVariantId: string | null;
  artworks: Record<string, ArtworkState>;
  autoRotate: boolean;
  selectedMethods: Record<string, string>; 
  selectedTiers: Record<string, string>;    

  setProduct: (product: ApparelProduct) => void;
  setSelectedPrintArea: (id: string) => void;
  setSelectedColor: (color: string) => void;
  setBackground: (background: string) => void;
  setSelectedVariant: (variantId: string) => void;
  setArtwork: (areaId: string, artwork: ArtworkState) => void;
  setAutoRotate: (value: boolean) => void;
  setSelectedMethod: (areaId: string, methodCode: string) => void;
  setSelectedTier: (areaId: string, tierSize: string) => void;
  reset: () => void;
}

const initialState: Omit<
  StudioState,
  keyof {
    setProduct: unknown;
    setSelectedPrintArea: unknown;
    setSelectedColor: unknown;
    setSelectedVariant: unknown;
    setArtwork: unknown;
    setAutoRotate: unknown;
    reset: unknown;
    
  }
> = {
  product: null,
  selectedPrintAreaId: null,
  selectedColor: null,
  selectedVariantId: null,
  artworks: {},
  autoRotate: false,
  selectedMethods: {},
    selectedTiers: {},
};

export const useStudioStore = create<StudioState>((set) => ({
  ...initialState,
  setProduct: (product) =>
    set((state) => {
      const defaultMethods: Record<string, string> = {};
      const defaultTiers: Record<string, string> = {};
      for (const area of product.printAreas) {
        const firstMethod = area.methods[0];
        if (firstMethod) {
          defaultMethods[area.id] = firstMethod.code;
          defaultTiers[area.id] = firstMethod.tiers[0]?.size ?? "";
        }
      }
      return {
        product,
        selectedColor: product.colors[0] || null,
        selectedPrintAreaId: product.printAreas[0]?.id || null,
        selectedVariantId: product.variants[0]?.id || null,
        artworks: {},
        selectedMethods: defaultMethods,
        selectedTiers: defaultTiers,
      };
    }),
  setSelectedPrintArea: (id) => set({ selectedPrintAreaId: id }),
  setSelectedColor: (color) => set({ selectedColor: color }),
  setBackground: (background) =>
  set((state) => {
    if (!state.product) return state;
    return {
      product: {
        ...state.product,
        renderConfig: { ...state.product.renderConfig, background },
      },
    };
  }),
  setSelectedVariant: (variantId) => set({ selectedVariantId: variantId }),
  setArtwork: (areaId, artwork) =>
    set((state) => ({
      artworks: { ...state.artworks, [areaId]: artwork },
    })),
  setAutoRotate: (autoRotate) => set({ autoRotate }),
  reset: () => set(initialState),

  setSelectedMethod: (areaId, methodCode) =>
    set((state) => ({
      selectedMethods: { ...state.selectedMethods, [areaId]: methodCode },
      // Reset tier when method changes
      selectedTiers: { ...state.selectedTiers, [areaId]: "" },
    })),
  setSelectedTier: (areaId, tierSize) =>
    set((state) => ({
      selectedTiers: { ...state.selectedTiers, [areaId]: tierSize },
    })),
}));

export interface SceneSnapshot {
  version: 2;
  productId: string;
  selectedPrintAreaId: string | null;
  selectedColor: string | null;
  selectedVariantId: string | null;
  artworks: Record<string, ArtworkState>;
  autoRotate: boolean;
}

export function buildSceneSnapshot(state: StudioState): SceneSnapshot {
  return {
    version: 2,
    productId: state.product?.id || "",
    selectedPrintAreaId: state.selectedPrintAreaId,
    selectedColor: state.selectedColor,
    selectedVariantId: state.selectedVariantId,
    artworks: state.artworks,
    autoRotate: state.autoRotate,
  };
}


/**
 * ZoneTransform: normalized user-facing transform for a decal zone.
 * Kept separate from ArtworkState for internal calculations.
 */
export interface ZoneTransform {
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
}

/**
 * Convert legacy ArtworkState to normalized ZoneTransform.
 */
export function toZoneTransform(artwork: ArtworkState): ZoneTransform {
  return {
    offsetX: artwork.decalOffsetX,
    offsetY: artwork.decalOffsetY,
    scale: artwork.decalScale,
    rotation: artwork.decalRotation,
  };
}


/**
 * Additions to the studio store — drop these into store.ts alongside existing code.
 * Exported helpers consumed by SaveProductDialog and StudioWorkspace.
 */



// ─── Print size classification ──────────────────────────────────────────────

export type PrintSizeTier = "logo" | "a6" | "a5" | "a4" | "a3" | "large";

export const PRINT_TIER_LABELS: Record<PrintSizeTier, string> = {
  logo: "Logo",
  a6: "A6",
  a5: "A5",
  a4: "A4",
  a3: "A3",
  large: "Large",
};

/**
 * Classifies a print area's dimensions into a size tier.
 * Used by both the UI and the backend for print pricing.
 *
 *  logo  ≤ 25 cm²  (≈ 5×5 cm)
 *  a6    ≤ 74 cm²  (≈ 10×7.4 cm)
 *  a5    ≤ 149 cm² (≈ 14.8×10.5 cm)
 *  a4    ≤ 312 cm² (≈ 21×14.8 cm)
 *  a3    ≤ 624 cm² (≈ 29.7×21 cm)
 *  large > 624 cm²
 */
export function classifyPrintSize(
  widthCm: number,
  heightCm: number,
): PrintSizeTier {
  const area = widthCm * heightCm;
  if (area <= 25) return "logo";
  if (area <= 74) return "a6";
  if (area <= 149) return "a5";
  if (area <= 312) return "a4";
  if (area <= 624) return "a3";
  return "large";
}

// ─── Enhanced SceneSnapshot builder ────────────────────────────────────────

// ─── Complete render config for marketplace reproduction ──────────────────

export interface CompleteRenderConfig {
  version: 3;
  background: string;
  environment: EnvironmentPreset;
  model_position: [number, number, number];
  model_url: string;
  colorable_meshes: string[];
  material: {
    texture_url: string | null;
    normal_map_url: string | null;
    roughness: number;
    metalness: number;
  };
  camera: {
    position: [number, number, number];
    fov: number;
    captureDistanceScale: number;
    captureLookAtOffset: number;
    orbit: {
      min_distance: number;
      max_distance: number;
      min_polar_angle: number;
      max_polar_angle: number;
      enable_pan: boolean;
      enable_zoom: boolean;
    };
  };
  lighting?: {
    ambient?: number;
    key?: { position: [number, number, number]; intensity: number };
    fill?: { position: [number, number, number]; intensity: number };
    rim?: { position: [number, number, number]; intensity: number };
  };
  contact_shadows: {
    enabled: boolean;
    position: [number, number, number];
    opacity: number;
    scale: number;
    blur: number;
    far: number;
  };
  shots: Array<{ id: string; label: string; azimuth: number; polar: number; enabled: boolean }>;
  default_view?: string;
  /**
   * Only print areas with applied artwork — each entry carries both the
   * placement geometry AND the decal/design data needed to reproduce it,
   * so the backend doesn't need to join against a separate array.
   */
  print_areas: Array<{
    print_area_id: string;
    area_key: string;
    name: string;
    placement: string;
    mesh_name: string;
    width_cm: number;
    height_cm: number;
    uv_config: {
      world_bounds?: {
        center: [number, number, number];
        half_extents: [number, number, number];
        rotation: [number, number, number];
      };
      uv_bounds?: { min_u: number; min_v: number; max_u: number; max_v: number };
      transform_limits?: {
        min_scale: number;
        max_scale: number;
        min_x: number;
        max_x: number;
        min_y: number;
        max_y: number;
      };
    };
    design: {
      layers: Array<{
        type: "image";
        url: string;
        aspect_ratio: number;
        scale: number;
        rotation: number;
        offset_x: number;
        offset_y: number;
        z_index: number;
      }>;
    };
  }>;
}

export function buildCompleteRenderConfig(
  state: Pick<StudioState, "product" | "artworks">,
  shots: Array<{ id: string; label: string; azimuth: number; polar: number; enabled: boolean }>,
): CompleteRenderConfig | null {
  const product = state.product;
  if (!product) return null;

  const render = product.renderConfig;
  const cam = product.cameraConfig;

  // Only print areas that actually have artwork applied.
  const activeAreas = product.printAreas.filter((area) => state.artworks[area.id]?.decalUrl);

  return {
    version: 3,
    background: render.background,
    environment: render.environment,
    model_position: render.modelPosition,
    model_url: product.modelUrl,
    colorable_meshes: product.colorableMeshes,
    material: {
      texture_url: product.materialConfig.textureUrl,
      normal_map_url: product.materialConfig.normalMapUrl,
      roughness: product.materialConfig.roughness,
      metalness: product.materialConfig.metalness,
    },
    camera: {
      position: cam.position,
      fov: cam.fov,
      captureDistanceScale: cam.captureDistanceScale,
      captureLookAtOffset: cam.captureLookAtOffset,
      orbit: {
        min_distance: cam.orbit.minDistance,
        max_distance: cam.orbit.maxDistance,
        min_polar_angle: cam.orbit.minPolarAngle,
        max_polar_angle: cam.orbit.maxPolarAngle,
        enable_pan: cam.orbit.enablePan,
        enable_zoom: cam.orbit.enableZoom,
      },
    },
    lighting: (render as any).lighting,
    contact_shadows: {
      enabled: render.contactShadows.enabled,
      position: render.contactShadows.position,
      opacity: render.contactShadows.opacity,
      scale: render.contactShadows.scale,
      blur: render.contactShadows.blur,
      far: render.contactShadows.far,
    },
    shots,
    default_view: product.defaultView,
    print_areas: activeAreas.map((area) => {
      const art = state.artworks[area.id];
      return {
        print_area_id: area.id,
        area_key: area.areaKey,
        name: area.name,
        placement: area.placement,
        mesh_name: area.meshName,
        width_cm: area.widthCm,
        height_cm: area.heightCm,
        uv_config: {
          world_bounds: area.worldBounds,
          uv_bounds: area.uvBounds
            ? {
                min_u: area.uvBounds.minU,
                min_v: area.uvBounds.minV,
                max_u: area.uvBounds.maxU,
                max_v: area.uvBounds.maxV,
              }
            : undefined,
          transform_limits: area.transformLimits
            ? {
                min_scale: area.transformLimits.minScale,
                max_scale: area.transformLimits.maxScale,
                min_x: area.transformLimits.minX,
                max_x: area.transformLimits.maxX,
                min_y: area.transformLimits.minY,
                max_y: area.transformLimits.maxY,
              }
            : undefined,
        },
        design: {
          layers: [
            {
              type: "image",
              url: art.decalUrl,
              aspect_ratio: art.decalAspect,
              scale: art.decalScale,
              rotation: art.decalRotation,
              offset_x: art.decalOffsetX,
              offset_y: art.decalOffsetY,
              z_index: 0,
            },
          ],
        },
      };
    }),
  };
}

export interface EnhancedSceneSnapshot {
  version: 3;
  productId: string;
  selectedPrintAreaId: string | null;
  selectedColor: string | null;
  selectedVariantId: string | null;
  autoRotate: boolean;
  /**
   * Artworks keyed by print area id.
   * decalUrl should be replaced with server URLs before sending to backend.
   */
  artworks: Record<string, ArtworkState>;
  /**
   * Per-print-area sizing info for backend pricing.
   */
  artworkPrintInfos: Array<{
    id: string;
    printAreaId: string;
    areaKey: string;
    printAreaName: string;
    widthCm: number;
    heightCm: number;
    sizeTier: PrintSizeTier;
    decalUrl: string;
  }>;
  artworkCount: number;
}

export function buildEnhancedSnapshot(
  state: {
    product: { id: string; printAreas: PrintArea[] } | null;
    selectedPrintAreaId: string | null;
    selectedColor: string | null;
    selectedVariantId: string | null;
    artworks: Record<string, ArtworkState>;
    autoRotate: boolean;
  },
): EnhancedSceneSnapshot {
  const activeArtworks = Object.entries(state.artworks).filter(
    ([, a]) => a.decalUrl,
  );

  return {
    version: 3,
    productId: state.product?.id ?? "",
    selectedPrintAreaId: state.selectedPrintAreaId,
    selectedColor: state.selectedColor,
    selectedVariantId: state.selectedVariantId,
    autoRotate: state.autoRotate,
    artworks: state.artworks,
    artworkPrintInfos,
    artworkCount: activeArtworks.length,
  };
}

// ─── Save Dialog State ─────────────────────────────────────────────────────

export interface SaveDialogState {
  isOpen: boolean;
  step: "preview" | "details";
  title: string;
  description: string;
  markup: number;
  isLimited: boolean;
  maxQuantity: number;
  primaryShotId: string;
  enabledVariantIds: Set<string>;
  enabledShotIds: Set<string>;
  isSubmitting: boolean;

  setStep: (step: "preview" | "details") => void;
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setMarkup: (markup: number) => void;
  setIsLimited: (value: boolean) => void;
  setMaxQuantity: (qty: number) => void;
  setPrimaryShotId: (id: string) => void;
  toggleVariant: (id: string) => void;
  toggleShot: (id: string) => void;
  setEnabledVariants: (ids: string[]) => void;
  setEnabledShots: (ids: string[]) => void;
  resetSaveDialog: () => void;
  openSaveDialog: () => void;
  closeSaveDialog: () => void;
  setSubmitting: (value: boolean) => void;
}

const defaultSaveDialogState: Omit<
  SaveDialogState,
  | "setStep"
  | "setTitle"
  | "setDescription"
  | "setMarkup"
  | "setIsLimited"
  | "setMaxQuantity"
  | "setPrimaryShotId"
  | "toggleVariant"
  | "toggleShot"
  | "setEnabledVariants"
  | "setEnabledShots"
  | "resetSaveDialog"
  | "openSaveDialog"
  | "closeSaveDialog"
  | "setSubmitting"
> = {
  isOpen: false,
  step: "preview",
  title: "",
  description: "",
  markup: 30,
  isLimited: false,
  maxQuantity: 100,
  primaryShotId: "front",
  enabledVariantIds: new Set(),
  enabledShotIds: new Set(["front", "back", "angle"]),
  isSubmitting: false,
};

export const useSaveDialogStore = create<SaveDialogState>((set, get) => ({
  ...defaultSaveDialogState,

  setStep: (step) => set({ step }),
  setTitle: (title) => set({ title }),
  setDescription: (description) => set({ description }),
  setMarkup: (markup) => set({ markup }),
  setIsLimited: (isLimited) => set({ isLimited }),
  setMaxQuantity: (maxQuantity) => set({ maxQuantity }),
  setPrimaryShotId: (primaryShotId) => set({ primaryShotId }),

  toggleVariant: (id) =>
    set((state) => {
      const next = new Set(state.enabledVariantIds);
      next.has(id) ? next.delete(id) : next.add(id);
      return { enabledVariantIds: next };
    }),

  toggleShot: (id) =>
    set((state) => {
      const next = new Set(state.enabledShotIds);
      next.has(id) ? next.delete(id) : next.add(id);
      return { enabledShotIds: next };
    }),

  setEnabledVariants: (ids) => set({ enabledVariantIds: new Set(ids) }),
  setEnabledShots: (ids) => set({ enabledShotIds: new Set(ids) }),

  resetSaveDialog: () => set(defaultSaveDialogState),

  openSaveDialog: () =>
    set({
      isOpen: true,
      step: "preview",
      isSubmitting: false,
    }),

  closeSaveDialog: () => set({ isOpen: false }),

  setSubmitting: (isSubmitting) => set({ isSubmitting }),
}));
