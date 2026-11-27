// src/features/studio/contract.ts
//
// Studio ⇄ backend contract. Everything here is the *wire format* (snake_case JSON) plus the
// mappers between it and the studio view model in ./types.ts:
//
//   GET  /studio/products/{slug}/config/   → RawStudioConfig   → mapStudioConfig()  → ProductConfig
//   GET  /studio/artwork/                  → Page<RawArtworkItem> → mapArtworkItem() → ArtworkItem
//   POST /studio/designs/  |  PUT /studio/designs/{id}/
//        ← buildSaveDesignBody()  → RawSaveDesignBody
//        → RawSaveDesignResponse  → mapSaveResponse() → SaveDesignResult
//
// The full, annotated description (with example payloads) lives in STUDIO_API.md at the repo root.

import type {
  ArtworkItem,
  CaptureAngle,
  CameraConfig,
  CaptureShot,
  EnvironmentConfig,
  FontOption,
  ImageLayer,
  Layer,
  LayerTransform,
  LightConfig,
  ModelAsset,
  ModelMaterial,
  PrintMethod,
  RotationConfig,
  PrintZone,
  ProductColor,
  ProductConfig,
  SaveDesignResult,
  TextLayer,
  UserTier,
  Vec3,
  VariantCombination,
} from "./types";

/* ───────────────────────────── raw (wire) types ───────────────────────────── */

export interface RawModel {
  url: string;
  format: "glb" | "gltf";
  /** Legacy single printable node; omit to use all meshes. */
  mesh_node?: string | null;
  /** Printable nodes of a multipart model; takes precedence over `mesh_node`. */
  printable_mesh_nodes?: string[] | null;
  /** Material slot to recolour / print on; other slots are left alone. */
  material_name?: string | null;
  scale: number;
  position: Vec3;
  rotation?: Vec3 | null;
  material?: {
    sheen?: number | null;
    sheen_roughness?: number | null;
    sheen_color?: string | null;
    roughness?: number | null;
    metalness?: number | null;
    env_map_intensity?: number | null;
    repeat?: [number, number] | null;
    maps?: { map_url?: string | null; normal_map_url?: string | null; roughness_map_url?: string | null; ao_map_url?: string | null } | null;
  } | null;
}

export interface RawScene {
  light: {
    ambient_intensity: number;
    key: { position: Vec3; intensity: number };
    rim: { position: Vec3; intensity: number };
  };
  camera: {
    position: Vec3;
    fov: number;
    target: Vec3;
    min_distance: number;
    max_distance: number;
    min_polar_angle?: number | null;
    max_polar_angle?: number | null;
  };
  /** Optional orbit behaviour; when absent the studio keeps its built-in defaults. */
  rotation?: {
    allow_360?: boolean | null;
    auto_rotate_in_edit?: boolean | null;
    auto_rotate_speed?: number | null;
    rotate_speed?: number | null;
    min_azimuth_angle?: number | null;
    max_azimuth_angle?: number | null;
    min_polar_angle?: number | null;
    max_polar_angle?: number | null;
  } | null;
  environment: {
    intensity: number;
    contact_shadow: { opacity: number; blur: number; y: number };
    auto_rotate_in_preview: boolean;
    auto_rotate_speed: number;
  };
  /** Default canvas backdrop as a hex colour; null = studio default. */
  background?: string | null;
}

export interface RawColor {
  id: string;
  name: string;
  hex: string;
  in_stock: boolean;
}

export interface RawVariants {
  options: { id: string; label: string; values: string[] }[];
  combinations: {
    variant_id: string;
    sku: string;
    color_id: string;
    options: Record<string, string>;
    in_stock: boolean;
    stock_quantity?: number;
    /** Decimal string. */
    price_adjustment?: string;
  }[];
}

export interface RawPrintZone {
  /** Newer backends send the area's UUID here and its short code in `code`. */
  id: string;
  /** Short zone code ("front"), informational. Zones are referenced by `id`. */
  code?: string;
  label: string;
  kind: "decal" | "wrap";
  mesh_node?: string | null;
  projection_depth?: number | null;
  position: Vec3;
  /** Euler angles in RADIANS. */
  rotation: Vec3;
  /** Max printable size in model units [w, h]. */
  size: [number, number];
  print_area_cm: [number, number];
  camera_position: Vec3;
  allowed_method_ids: string[];
}

export interface RawPrintMethod {
  /** The method's primary key (UUID). Older payloads put the short code here instead. */
  id: string;
  /** Short code ("dtf", "dtg"); lookups by code are accepted for allowed_method_ids / default. */
  code?: string;
  /** Some payloads send the UUID separately from a code-valued `id`. */
  uuid?: string;
  pk?: string;
  label: string;
  description: string;
  min_tier: UserTier;
  max_colors: number | null;
  supports_photos: boolean;
  /** Decimal string surcharge on top of the base price. */
  price_delta: string;
}

export interface RawLayerTransform {
  /** Offset inside the zone, -1..1 (x right, y up). */
  x: number;
  y: number;
  /** Fraction of the zone height, 0.05–1.2. */
  scale: number;
  /** Degrees, -180..180. */
  rotation: number;
  /** 0..1 */
  opacity: number;
}

export interface RawLayer {
  /** Client-generated id (kept as the layer's stable id when saved). */
  id: string;
  kind: "text" | "artwork" | "sticker" | "shape" | "upload";
  name: string;
  zone_id: string;
  visible: boolean;
  locked: boolean;
  /** Global stacking order, 0 = bottom. Informational on read, authoritative on save. */
  z_index?: number;
  transform: RawLayerTransform;
  /** Present when kind === "text". */
  text?: {
    content: string;
    font_id?: string | null;
    font_family: string;
    font_weight: number;
    color: string;
    letter_spacing: number;
    align: "left" | "center" | "right";
    italic: boolean;
  };
  /** Present for every non-text layer. `src` is read-only (ignored on save). */
  image?: {
    src?: string;
    artwork_id?: string | null;
    asset_id?: string | null;
  };
}

export interface RawStudioConfig {
  id: string;
  slug: string;
  name: string;
  description?: string;
  /** Decimal string. */
  base_price: string;
  currency: { code: string; symbol: string; decimal_places?: number };
  model: RawModel;
  scene: RawScene;
  colors: RawColor[];
  default_color_id: string;
  variants: RawVariants;
  print_zones: RawPrintZone[];
  print_methods: RawPrintMethod[];
  default_print_method_id?: string | null;
  pricing: { extra_zone_price: string };
  editor: {
    fonts: { id: string; label: string; family: string }[];
    text_colors: string[];
    background_swatches: string[];
    premium_artwork_min_tier?: UserTier;
    /** Which layer sources the product's artwork policy switches on (all default ON). */
    artwork_allowed?: { tied?: boolean; library?: boolean; uploads?: boolean; text?: boolean };
    /** Artwork configured for this product, in tie order; exact B.4.3 row shape. Only usable while `artwork_allowed.tied`. */
    tied_artwork?: RawArtworkItem[];
    upload?: { max_bytes?: number; accepted_mime_types?: string[]; allowed?: boolean };
  };
  capture?: { shots: { angle: CaptureAngle; position: Vec3 }[] };
  /** Plan of the signed-in buyer (drives which methods / premium artwork are unlocked). */
  user_tier: UserTier;
  /** Starting layers. Empty for a blank; the creator's layers when `?from=` is used. */
  initial_layers: RawLayer[];
  derived_from_published_product_id?: string | null;
  /** Set when the config was requested with `?design=<id>`: the caller's own saved design being edited (a re-save is a PUT). */
  editing_design_id?: string | null;
}

export interface RawArtworkItem {
  id: string;
  name: string;
  category: "artwork" | "sticker" | "shape" | "mine";
  /** Registered asset id — set for the caller's own uploads (`category=mine`); a layer then references `asset_id` instead of `artwork_id`. */
  asset_id?: string | null;
  /** Full-size image the canvas draws. Must be CORS-readable (canvas texture). */
  src: string;
  thumbnail_url?: string | null;
  premium: boolean;
  /** Used to order uploads newest-first when present. */
  created_at?: string | null;
}

export interface RawSaveZone {
  zone_id: string;
  print_method_id: string;
  /** Layers on this zone, bottom → top. */
  layers: RawLayer[];
}

export interface RawSaveDesignBody {
  schema_version: "studio.v2";
  product_id: string;
  /** Orderable variant used as the design's default (selected colour, first in-stock size). */
  default_variant_id: string;
  derived_from_published_product_id?: string;
  /** Omitted on re-save (PUT) so a title edited elsewhere is never overwritten. */
  title?: string;
  description?: string;
  /** `order` (default): a personal design the buyer will order. `listing`: a draft product in the creator's store. */
  purpose?: "order" | "listing";
  /** Listing drafts only: unlisted after approval — reachable through its share link. */
  is_private?: boolean;
  color_id: string;
  color_hex: string;
  /** User-chosen canvas backdrop; null = studio default. */
  background_color: string | null;
  /** The print method selected in the studio (zones list the method actually used per zone). */
  print_method_id: string;
  print_zones: RawSaveZone[];
  /** One registered `design_mockup` asset per captured angle. */
  mockups: { asset_id: string; angle: CaptureAngle; is_primary: boolean; display_order: number }[];
  /** Client-side estimate for diagnostics only; the server recomputes the price. */
  client_price_estimate: { amount: string; currency_code: string };
  client: { app: "buyer-studio" | "creator-studio"; captured_at: string };
}

export interface RawSaveDesignResponse {
  id: string;
  status: string;
  title: string;
  currency_symbol: string;
  pricing: {
    base_price: string;
    print_cost: string;
    unit_price: string;
  };
  mockups?: { url: string; angle: string; is_primary: boolean }[];
  /** Echo of the visibility flag sent on save. */
  is_private?: boolean;
}

/* ───────────────────────────── defaults ───────────────────────────── */

/** Canvas colour used when the backend sends none. Independent of the light / dark UI theme. */
export const DEFAULT_STUDIO_BACKGROUND = "#e4e7ec";

const DEFAULT_SHOTS: CaptureShot[] = [
  { angle: "front", position: [0, 0.05, 1.6] },
  { angle: "back", position: [0, 0.05, -1.6] },
  { angle: "left", position: [1.6, 0.05, 0] },
  { angle: "right", position: [-1.6, 0.05, 0] },
  { angle: "detail", position: [0.15, 0.1, 0.8] },
];

const DEFAULT_UPLOAD = {
  maxBytes: 20 * 1024 * 1024,
  acceptedMimeTypes: ["image/png", "image/jpeg", "image/svg+xml", "image/webp"],
};

const num = (v: string | number | null | undefined, fallback = 0) => {
  const n = typeof v === "number" ? v : parseFloat(v ?? "");
  return Number.isFinite(n) ? n : fallback;
};

/* ───────────────────────────── raw → view model ───────────────────────────── */

export function mapLayer(raw: RawLayer, fonts: FontOption[]): Layer {
  const base = {
    id: raw.id,
    name: raw.name,
    zoneId: raw.zone_id,
    visible: raw.visible,
    locked: raw.locked,
    transform: { ...raw.transform } as LayerTransform,
  };
  if (raw.kind === "text" && raw.text) {
    const t = raw.text;
    const family = t.font_family || fonts.find((f) => f.id === t.font_id)?.family || fonts[0]?.family || "sans-serif";
    return {
      ...base,
      kind: "text",
      text: t.content,
      fontFamily: family,
      fontWeight: t.font_weight,
      color: t.color,
      letterSpacing: t.letter_spacing,
      align: t.align,
      italic: t.italic,
    } satisfies TextLayer;
  }
  return {
    ...base,
    kind: raw.kind === "text" ? "artwork" : raw.kind,
    src: raw.image?.src ?? "",
    ...(raw.image?.artwork_id ? { artworkId: raw.image.artwork_id } : {}),
    ...(raw.image?.asset_id ? { assetId: raw.image.asset_id } : {}),
  } satisfies ImageLayer;
}

export function mapZone(z: RawPrintZone): PrintZone {
  return {
    // The save body and layers address a zone by its id (the printable area's UUID); `code` is only a readable hint.
    id: z.id,
    ...(z.code ? { code: z.code } : {}),
    label: z.label,
    kind: z.kind,
    ...(z.mesh_node ? { meshNode: z.mesh_node } : {}),
    ...(z.projection_depth != null ? { projectionDepth: z.projection_depth } : {}),
    position: z.position,
    rotation: z.rotation,
    size: z.size,
    printAreaCm: z.print_area_cm,
    cameraPosition: z.camera_position,
    allowedMethods: z.allowed_method_ids ?? [],
  };
}

export function mapModel(m: RawModel): ModelAsset {
  return {
    url: m.url.replace(/[:\s]+$/, ""),
    format: m.format,
    ...(m.mesh_node ? { meshNode: m.mesh_node } : {}),
    ...(m.printable_mesh_nodes?.length ? { printableMeshNodes: m.printable_mesh_nodes } : {}),
    ...(m.material_name ? { materialName: m.material_name } : {}),
    scale: m.scale,
    position: m.position,
    ...(m.rotation ? { rotation: m.rotation } : {}),
    ...(mapMaterial(m.material) ? { material: mapMaterial(m.material)! } : {}),
  };
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Only the fields the backend actually sent; null / missing ones keep the model's own look. */
export function mapMaterial(m: RawModel["material"]): ModelMaterial | undefined {
  if (!m) return undefined;
  const maps = m.maps
    ? {
        ...(m.maps.map_url ? { map: m.maps.map_url } : {}),
        ...(m.maps.normal_map_url ? { normalMap: m.maps.normal_map_url } : {}),
        ...(m.maps.roughness_map_url ? { roughnessMap: m.maps.roughness_map_url } : {}),
        ...(m.maps.ao_map_url ? { aoMap: m.maps.ao_map_url } : {}),
      }
    : {};
  const out: ModelMaterial = {
    ...(finite(m.roughness) ? { roughness: m.roughness } : {}),
    ...(finite(m.metalness) ? { metalness: m.metalness } : {}),
    ...(finite(m.env_map_intensity) ? { envMapIntensity: m.env_map_intensity } : {}),
    ...(finite(m.sheen) ? { sheen: m.sheen } : {}),
    ...(finite(m.sheen_roughness) ? { sheenRoughness: m.sheen_roughness } : {}),
    ...(typeof m.sheen_color === "string" && m.sheen_color ? { sheenColor: m.sheen_color } : {}),
    ...(m.repeat && finite(m.repeat[0]) && finite(m.repeat[1]) ? { repeat: [m.repeat[0], m.repeat[1]] as [number, number] } : {}),
    ...(Object.keys(maps).length ? { maps } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}

export function mapRotation(r: RawScene["rotation"], camera: RawScene["camera"]): RotationConfig | undefined {
  const polarMin = r?.min_polar_angle ?? camera.min_polar_angle;
  const polarMax = r?.max_polar_angle ?? camera.max_polar_angle;
  const out: RotationConfig = {
    ...(typeof r?.allow_360 === "boolean" ? { allow360: r.allow_360 } : {}),
    ...(typeof r?.auto_rotate_in_edit === "boolean" ? { autoRotateInEdit: r.auto_rotate_in_edit } : {}),
    ...(finite(r?.auto_rotate_speed) ? { autoRotateSpeed: r.auto_rotate_speed } : {}),
    ...(finite(r?.rotate_speed) ? { rotateSpeed: r.rotate_speed } : {}),
    ...(finite(r?.min_azimuth_angle) ? { minAzimuthAngle: r.min_azimuth_angle } : {}),
    ...(finite(r?.max_azimuth_angle) ? { maxAzimuthAngle: r.max_azimuth_angle } : {}),
    ...(finite(polarMin) ? { minPolarAngle: polarMin } : {}),
    ...(finite(polarMax) ? { maxPolarAngle: polarMax } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}

export function mapScene(scene: RawScene) {
  return {
    light: {
      ambientIntensity: scene.light.ambient_intensity,
      key: scene.light.key,
      rim: scene.light.rim,
    } as LightConfig,
    camera: {
      position: scene.camera.position,
      fov: scene.camera.fov,
      target: scene.camera.target,
      minDistance: scene.camera.min_distance,
      maxDistance: scene.camera.max_distance,
      ...(finite(scene.camera.min_polar_angle) ? { minPolarAngle: scene.camera.min_polar_angle } : {}),
      ...(finite(scene.camera.max_polar_angle) ? { maxPolarAngle: scene.camera.max_polar_angle } : {}),
    } as CameraConfig,
    environment: {
      intensity: scene.environment.intensity,
      contactShadow: scene.environment.contact_shadow,
      autoRotateInPreview: scene.environment.auto_rotate_in_preview,
      autoRotateSpeed: scene.environment.auto_rotate_speed,
    } as EnvironmentConfig,
    rotation: mapRotation(scene.rotation, scene.camera),
    background: scene.background ?? null,
  };
}

/** Read-only 3D preview bundle used by the product detail page (`viewer_3d`). */
export interface RawViewer3D {
  model: RawModel;
  scene: RawScene;
  print_zones: RawPrintZone[];
  /** The design's layers, bottom → top, with `image.src` resolved. Zones with no layers are fine. */
  layers: RawLayer[];
}

export interface Viewer3D {
  model: ModelAsset;
  light: LightConfig;
  camera: CameraConfig;
  environment: EnvironmentConfig;
  rotation?: RotationConfig | undefined;
  background: string | null;
  printZones: PrintZone[];
  layers: Layer[];
}

export function mapViewer3D(raw: RawViewer3D): Viewer3D {
  const sc = mapScene(raw.scene);
  return {
    model: mapModel(raw.model),
    light: sc.light,
    camera: sc.camera,
    environment: sc.environment,
    ...(sc.rotation ? { rotation: sc.rotation } : {}),
    background: sc.background,
    printZones: raw.print_zones.map(mapZone),
    // Fonts only matter when a layer lacks `font_family`; the viewer has no font list, so none are needed.
    // A layer may reference its zone by UUID or by code; either resolves to the zone's `id`.
    layers: (raw.layers ?? []).map((l) => {
      const layer = mapLayer(l, []);
      const zone = raw.print_zones.find((z) => z.id === layer.zoneId || z.code === layer.zoneId);
      return zone ? { ...layer, zoneId: zone.id } : layer;
    }),
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The id sent back as `print_method_id` on save: the method's UUID (the backend resolves it by primary key). */
export function printMethodUuid(m: RawPrintMethod): string {
  const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);
  // Preferred keys first, then any other field that holds a UUID (the config's key for it varies between backends).
  const found = [m.id, m.uuid, m.pk].find(isUuid) ?? Object.values(m as unknown as Record<string, unknown>).find(isUuid);
  return found ?? m.id;
}

export function mapStudioConfig(raw: RawStudioConfig): ProductConfig {
  const fonts: FontOption[] = raw.editor.fonts.map((f) => ({ id: f.id, label: f.label, family: f.family }));
  const colors: ProductColor[] = raw.colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex, inStock: c.in_stock }));
  // Zones / defaults may reference methods by UUID or by code; everything is normalised to the UUID.
  const methodRef = new Map<string, string>();
  for (const m of raw.print_methods) {
    const uuid = printMethodUuid(m);
    for (const ref of [m.id, m.code, m.uuid, m.pk, uuid, ...Object.values(m)]) if (typeof ref === "string" && ref) methodRef.set(ref, uuid);
  }
  const toUuid = (ref: string) => methodRef.get(ref) ?? ref;
  const printZones: PrintZone[] = raw.print_zones.map((z) => {
    const mapped = mapZone(z);
    return { ...mapped, allowedMethods: mapped.allowedMethods.map(toUuid) };
  });
  const printMethods: PrintMethod[] = raw.print_methods.map((m) => ({
    id: printMethodUuid(m),
    label: m.label,
    description: m.description,
    minTier: m.min_tier,
    maxColors: m.max_colors,
    supportsPhotos: m.supports_photos,
    priceDelta: num(m.price_delta),
  }));
  const combinations: VariantCombination[] = raw.variants.combinations.map((c) => ({
    variantId: c.variant_id,
    sku: c.sku,
    colorId: c.color_id,
    options: c.options,
    inStock: c.in_stock,
    stockQuantity: c.stock_quantity ?? (c.in_stock ? 99 : 0),
    priceAdjustment: c.price_adjustment ?? "0.00",
  }));
  const firstZone = printZones[0];
  const defaultRef = raw.default_print_method_id ? toUuid(raw.default_print_method_id) : null;
  const defaultMethod =
    defaultRef && printMethods.some((m) => m.id === defaultRef)
      ? defaultRef
      : (printMethods.find((m) => firstZone?.allowedMethods.includes(m.id))?.id ?? printMethods[0]?.id ?? "");
  const defaultColor = colors.find((c) => c.id === raw.default_color_id && c.inStock) ?? colors.find((c) => c.inStock) ?? colors[0];
  const shots = raw.capture?.shots?.length ? raw.capture.shots : DEFAULT_SHOTS;

  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    description: raw.description ?? "",
    basePrice: num(raw.base_price),
    currency: raw.currency.code,
    currencySymbol: raw.currency.symbol || raw.currency.code,
    model: mapModel(raw.model),
    ...(() => {
      const sc = mapScene(raw.scene);
      return { light: sc.light, camera: sc.camera, environment: sc.environment, background: sc.background, ...(sc.rotation ? { rotation: sc.rotation } : {}) };
    })(),
    colors,
    defaultColorId: defaultColor?.id ?? raw.default_color_id,
    variants: { options: raw.variants.options, combinations },
    printZones,
    printMethods,
    defaultPrintMethodId: defaultMethod,
    pricing: { extraZonePrice: num(raw.pricing.extra_zone_price) },
    editor: {
      fonts,
      textColors: raw.editor.text_colors,
      backgroundSwatches: raw.editor.background_swatches,
      premiumArtworkMinTier: raw.editor.premium_artwork_min_tier ?? "pro",
      artworkAllowed: {
        tied: raw.editor.artwork_allowed?.tied ?? true,
        library: raw.editor.artwork_allowed?.library ?? true,
        // `upload.allowed` carries the same value as the uploads toggle.
        uploads: raw.editor.artwork_allowed?.uploads ?? raw.editor.upload?.allowed ?? true,
        text: raw.editor.artwork_allowed?.text ?? true,
      },
      tiedArtwork: (raw.editor.tied_artwork ?? []).map(mapArtworkItem),
      upload: {
        maxBytes: raw.editor.upload?.max_bytes ?? DEFAULT_UPLOAD.maxBytes,
        acceptedMimeTypes: raw.editor.upload?.accepted_mime_types ?? DEFAULT_UPLOAD.acceptedMimeTypes,
      },
    },
    capture: { shots: shots.map((s) => ({ angle: s.angle, position: s.position })) },
    userTier: raw.user_tier,
    initialLayers: raw.initial_layers.map((l) => mapLayer(l, fonts)),
    derivedFromPublishedProductId: raw.derived_from_published_product_id ?? null,
    editingDesignId: raw.editing_design_id ?? null,
  };
}

export function mapArtworkItem(raw: RawArtworkItem): ArtworkItem {
  return { id: raw.id, name: raw.name, category: raw.category, src: raw.src, premium: raw.premium, ...(raw.asset_id ? { assetId: raw.asset_id } : {}), ...(raw.created_at ? { createdAt: raw.created_at } : {}) };
}

export function mapSaveResponse(raw: RawSaveDesignResponse): SaveDesignResult {
  return {
    designId: raw.id,
    status: raw.status,
    title: raw.title,
    currencySymbol: raw.currency_symbol,
    pricing: {
      basePrice: num(raw.pricing.base_price),
      printCost: num(raw.pricing.print_cost),
      unitPrice: num(raw.pricing.unit_price),
    },
    mockups: (raw.mockups ?? []).map((m) => ({ url: m.url, angle: m.angle, isPrimary: m.is_primary })),
    isPrivate: raw.is_private ?? false,
  };
}

/* ───────────────────────────── pricing ───────────────────────────── */

const TIER_RANK: Record<UserTier, number> = { standard: 0, pro: 1, business: 2 };

export function tierAllows(userTier: UserTier, minTier: UserTier) {
  return TIER_RANK[userTier] >= TIER_RANK[minTier];
}

/** Base + method surcharge + `extraZonePrice` for every printed zone beyond the first (estimate only). */
export function estimatePrice(product: ProductConfig, methodDelta: number, printedZones: number) {
  return product.basePrice + methodDelta + Math.max(0, printedZones - 1) * product.pricing.extraZonePrice;
}

/* ───────────────────────────── view model → save body ───────────────────────────── */

const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

export function layerToRaw(layer: Layer, zIndex: number, fonts: FontOption[]): RawLayer {
  const base = {
    id: layer.id,
    name: layer.name,
    zone_id: layer.zoneId,
    visible: layer.visible,
    locked: layer.locked,
    z_index: zIndex,
    transform: {
      x: r4(layer.transform.x),
      y: r4(layer.transform.y),
      scale: r4(layer.transform.scale),
      rotation: r4(layer.transform.rotation),
      opacity: r4(layer.transform.opacity),
    },
  };
  if (layer.kind === "text") {
    return {
      ...base,
      kind: "text",
      text: {
        content: layer.text,
        font_id: fonts.find((f) => f.family === layer.fontFamily)?.id ?? null,
        font_family: layer.fontFamily,
        font_weight: layer.fontWeight,
        color: layer.color,
        letter_spacing: layer.letterSpacing,
        align: layer.align,
        italic: layer.italic,
      },
    };
  }
  return {
    ...base,
    kind: layer.kind,
    image: {
      artwork_id: layer.artworkId ?? null,
      asset_id: layer.assetId ?? null,
    },
  };
}

export interface SaveValidationIssue {
  message: string;
}

/** Client-side checks that mirror what the server enforces; returns the first problem or null. */
/** Why a layer can't be saved under the product's current artwork policy (null = fine). Saves are strict: no grandfathering. */
export function layerRestriction(product: ProductConfig, layer: Layer): string | null {
  const allow = product.editor.artworkAllowed;
  if (layer.kind === "text") return allow.text ? null : "Text layers are not allowed on this product.";
  const img = layer as ImageLayer;
  if (layer.kind === "upload") {
    // Inherited (locked) uploads from a customize-on-top base stay valid: ownership, not policy, governs them.
    return allow.uploads || layer.locked ? null : "Uploaded artwork is not allowed on this product.";
  }
  const tied = product.editor.tiedArtwork.some((t) => t.id === img.artworkId || (!!img.assetId && t.assetId === img.assetId));
  const ok = tied ? allow.tied || allow.library : allow.library;
  return ok ? null : "This artwork is not available for this product.";
}

/** Layers that can no longer be saved on this product (shown with a badge + Remove). */
export function restrictedLayers(product: ProductConfig, layers: Layer[]): { layer: Layer; reason: string }[] {
  return layers.flatMap((layer) => {
    const reason = layerRestriction(product, layer);
    return reason ? [{ layer, reason }] : [];
  });
}

export function validateForSave(opts: {
  product: ProductConfig;
  layers: Layer[];
  printMethodId: string;
  /** Resolved method per zone id; zones missing from it use `printMethodId`. */
  zoneMethods?: Record<string, string>;
}): string | null {
  const { product, layers, printMethodId } = opts;
  const restricted = restrictedLayers(product, layers);
  if (restricted.length) return `${restricted[0]!.reason} Remove "${restricted[0]!.layer.name}" to save.`;
  const printed = layers.filter((l) => l.visible && l.transform.opacity > 0);
  if (printed.length === 0) return "Add artwork or text to at least one print area";
  if (layers.some((l) => l.kind !== "text" && (l as ImageLayer).uploading)) {
    return "Your artwork is still uploading — try again in a moment";
  }
  for (const zoneId of new Set(printed.map((l) => l.zoneId))) {
    const zone = product.printZones.find((z) => z.id === zoneId);
    if (!zone) return "A layer sits on a print area that no longer exists";
    const methodId = opts.zoneMethods?.[zoneId] ?? printMethodId;
    const method = product.printMethods.find((m) => m.id === methodId);
    if (!method) return "Choose a print method";
    if (!tierAllows(product.userTier, method.minTier)) return `${method.label} requires the ${method.minTier} plan`;
    if (!zone.allowedMethods.includes(methodId)) {
      return `${method.label} isn't available on ${zone.label.toLowerCase()} — pick another method or move its layers`;
    }
  }
  const missingAsset = printed.find((l) => l.kind === "upload" && !(l as ImageLayer).assetId);
  if (missingAsset) return `"${missingAsset.name}" wasn't uploaded — remove it and add it again`;
  return null;
}

/** Picks the orderable variant that represents the design: selected colour, first in-stock size. */
export function pickDefaultVariant(product: ProductConfig, colorId: string): VariantCombination | undefined {
  const combos = product.variants.combinations;
  return (
    combos.find((c) => c.colorId === colorId && c.inStock) ??
    combos.find((c) => c.inStock) ??
    combos.find((c) => c.colorId === colorId)
  );
}

export function buildSaveDesignBody(opts: {
  product: ProductConfig;
  colorId: string;
  printMethodId: string;
  /** Resolved method per zone id (see resolveZoneMethod); zones missing from it use `printMethodId`. */
  zoneMethods?: Record<string, string>;
  layers: Layer[];
  bgColor: string | null;
  mockups: { assetId: string; angle: CaptureAngle }[];
  derivedFrom: string | null;
  estimate: number;
  now?: Date;
  /** Which app is saving, and for what. */
  app?: "buyer-studio" | "creator-studio";
  purpose?: "order" | "listing";
  isPrivate?: boolean;
  /** True when updating an existing design: title/description are left out. */
  isUpdate?: boolean;
}): RawSaveDesignBody {
  const { product, layers } = opts;
  const color = product.colors.find((c) => c.id === opts.colorId);
  const variant = pickDefaultVariant(product, opts.colorId);
  if (!variant) throw new Error("No variants are available for this product");

  // Group by zone (store order = z-order), keeping every layer — hidden ones too — so the design reopens as edited.
  const byZone = new Map<string, RawLayer[]>();
  layers.forEach((layer, i) => {
    const list = byZone.get(layer.zoneId) ?? [];
    list.push(layerToRaw(layer, i, product.editor.fonts));
    byZone.set(layer.zoneId, list);
  });
  const print_zones: RawSaveZone[] = product.printZones
    .filter((z) => byZone.has(z.id))
    .map((z) => ({ zone_id: z.id, print_method_id: opts.zoneMethods?.[z.id] ?? opts.printMethodId, layers: byZone.get(z.id)! }));

  return {
    schema_version: "studio.v2",
    product_id: product.id,
    default_variant_id: variant.variantId,
    ...(opts.derivedFrom ? { derived_from_published_product_id: opts.derivedFrom } : {}),
    ...(opts.isUpdate ? {} : { title: `${product.name} — Custom`, description: `Custom ${product.name} with artwork` }),
    ...(opts.purpose ? { purpose: opts.purpose } : {}),
    ...(opts.isPrivate != null ? { is_private: opts.isPrivate } : {}),
    color_id: opts.colorId,
    color_hex: color?.hex ?? "",
    background_color: opts.bgColor,
    // Top level = the method of the first printed zone (each zone also carries its own).
    print_method_id: print_zones[0]?.print_method_id ?? opts.printMethodId,
    print_zones,
    mockups: opts.mockups.map((m, i) => ({
      asset_id: m.assetId,
      angle: m.angle,
      is_primary: i === 0,
      display_order: i,
    })),
    client_price_estimate: { amount: opts.estimate.toFixed(2), currency_code: product.currency },
    client: { app: opts.app ?? "buyer-studio", captured_at: (opts.now ?? new Date()).toISOString() },
  };
}
