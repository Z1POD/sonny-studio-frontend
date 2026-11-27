// Studio view model. The backend speaks snake_case (see contract.ts / STUDIO_API.md);
// contract.ts maps those payloads into these camelCase types.

export type Vec3 = [number, number, number];

export type StudioMode = "edit" | "preview";
export type UserTier = "standard" | "pro" | "business";
/** Backend print-method id (stable string, e.g. "dtg" or a uuid). */
export type PrintMethodId = string;
export type ZoneId = string;
export type PanelId = "adjust" | "artwork" | "text" | "color" | "zones" | "layers" | null;

export interface ModelAsset {
  url: string;
  format: "glb" | "gltf";
  /** Legacy single printable node; omit to use all meshes. */
  meshNode?: string;
  /** Printable nodes for multipart products; takes precedence over meshNode. */
  printableMeshNodes?: string[];
  /** Optional material slot to recolor/UV-print; other slots stay unchanged. */
  materialName?: string;
  scale: number;
  position: Vec3;
  rotation?: Vec3;
  /** Optional surface tuning from the backend; every field falls back to the model's own material. */
  material?: ModelMaterial;
}

export interface ModelMaterial {
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  /** Fabric sheen (MeshPhysicalMaterial): strength, roughness and tint colour. */
  sheen?: number;
  sheenRoughness?: number;
  sheenColor?: string;
  /** Texture repeat [u, v]. */
  repeat?: [number, number];
  maps?: { map?: string; normalMap?: string; roughnessMap?: string; aoMap?: string };
}

export interface LightConfig {
  ambientIntensity: number;
  key: { position: Vec3; intensity: number };
  rim: { position: Vec3; intensity: number };
}

export interface CameraConfig {
  position: Vec3;
  fov: number;
  target: Vec3;
  minDistance: number;
  maxDistance: number;
  /** Vertical orbit limits in radians (0 = straight above, π = straight below). */
  minPolarAngle?: number;
  maxPolarAngle?: number;
}

/** How the product may be orbited. Absent / null fields keep the previous defaults. */
export interface RotationConfig {
  allow360?: boolean;
  autoRotateInEdit?: boolean;
  autoRotateSpeed?: number;
  rotateSpeed?: number;
  minAzimuthAngle?: number | null;
  maxAzimuthAngle?: number | null;
  minPolarAngle?: number | null;
  maxPolarAngle?: number | null;
}

export interface EnvironmentConfig {
  intensity: number;
  contactShadow: { opacity: number; blur: number; y: number };
  autoRotateInPreview: boolean;
  autoRotateSpeed: number;
}

export interface ProductColor {
  id: string;
  name: string;
  hex: string;
  inStock: boolean;
}

export interface VariantOption {
  id: string;
  label: string;
  values: string[];
}

/** One orderable combination (colour × size …). `variantId` is what checkout / orders reference. */
export interface VariantCombination {
  variantId: string;
  sku: string;
  colorId: string;
  options: Record<string, string>;
  inStock: boolean;
  stockQuantity: number;
  /** Decimal string, added to the unit price. */
  priceAdjustment: string;
}

export interface VariantMatrix {
  options: VariantOption[];
  combinations: VariantCombination[];
}

export interface FontOption {
  id: string;
  label: string;
  /** CSS font-family stack used to draw the text layer. */
  family: string;
}

export interface EditorConfig {
  fonts: FontOption[];
  textColors: string[];
  backgroundSwatches: string[];
  /** Lowest plan allowed to use `premium` library artwork. */
  premiumArtworkMinTier: UserTier;
  /** Artwork policy: which layer sources this product offers. */
  artworkAllowed: { tied: boolean; library: boolean; uploads: boolean; text: boolean };
  /** The product's own artwork, in tie order (render first when `artworkAllowed.tied`). */
  tiedArtwork: ArtworkItem[];
  upload: { maxBytes: number; acceptedMimeTypes: string[] };
}

export interface CaptureShot {
  angle: CaptureAngle;
  position: Vec3;
}

export interface PricingConfig {
  /** Surcharge for every printed zone beyond the first. */
  extraZonePrice: number;
}

export interface PrintZone {
  id: ZoneId;
  /** Short readable code ("front", "back", "sleeve_l"), when the backend sends one. */
  code?: string;
  label: string;
  /** decal = projected print, wrap = all-over UV-mapped print */
  kind: "decal" | "wrap";
  /** Target node in multipart models. Anchors use that mesh's local coordinates. */
  meshNode?: string;
  /** Projection depth in local model units. */
  projectionDepth?: number;
  /** decal anchor on the mesh surface */
  position: Vec3;
  rotation: Vec3;
  /** max printable size in model units [w, h] */
  size: [number, number];
  /** real-world bounds for production */
  printAreaCm: [number, number];
  /** camera position for focusing this zone */
  cameraPosition: Vec3;
  allowedMethods: PrintMethodId[];
}

export interface PrintMethod {
  id: PrintMethodId;
  label: string;
  description: string;
  minTier: UserTier;
  maxColors: number | null;
  supportsPhotos: boolean;
  priceDelta: number;
}

export interface LayerTransform {
  /** offset within zone, normalized -1..1 */
  x: number;
  y: number;
  /** 0.1 – 1 of zone height */
  scale: number;
  /** degrees */
  rotation: number;
  opacity: number;
}

interface BaseLayer {
  id: string;
  name: string;
  zoneId: ZoneId;
  visible: boolean;
  locked: boolean;
  transform: LayerTransform;
}

export interface TextLayer extends BaseLayer {
  kind: "text";
  text: string;
  fontFamily: string;
  fontWeight: number;
  color: string;
  letterSpacing: number;
  align: "left" | "center" | "right";
  italic: boolean;
}

export interface ImageLayer extends BaseLayer {
  kind: "artwork" | "sticker" | "shape" | "upload";
  /** What the canvas draws (library URL, or a local blob URL while an upload is in flight). */
  src: string;
  /** Library item this layer was created from (`kind` artwork / sticker / shape). */
  artworkId?: string;
  /** Registered asset (`kind` "upload", or a library item mirrored as an asset). */
  assetId?: string;
  /** True while the file is still being uploaded; saving is blocked until it clears. */
  uploading?: boolean;
}

export type Layer = TextLayer | ImageLayer;

export interface ProductConfig {
  id: string;
  slug: string;
  name: string;
  description: string;
  basePrice: number;
  currency: string;
  currencySymbol: string;
  model: ModelAsset;
  light: LightConfig;
  camera: CameraConfig;
  environment: EnvironmentConfig;
  rotation?: RotationConfig;
  /** Default canvas background (hex); null = the studio's own backdrop. */
  background: string | null;
  colors: ProductColor[];
  defaultColorId: string;
  variants: VariantMatrix;
  printZones: PrintZone[];
  printMethods: PrintMethod[];
  defaultPrintMethodId: PrintMethodId;
  pricing: PricingConfig;
  editor: EditorConfig;
  capture: { shots: CaptureShot[] };
  userTier: UserTier;
  initialLayers: Layer[];
  /** Set when the session was opened from a published design ("Personalize this design"). */
  derivedFromPublishedProductId: string | null;
  /** The caller's own saved design being edited (config requested with `?design=`); a save is then an update. */
  editingDesignId: string | null;
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  available: boolean;
}

export type CaptureAngle = "front" | "back" | "left" | "right" | "detail";

export interface MockupCapture {
  angle: CaptureAngle;
  dataUrl: string;
}

export interface ArtworkItem {
  id: string;
  name: string;
  category: "artwork" | "sticker" | "shape" | "mine";
  src: string;
  premium: boolean;
  /** Own uploads only: the registered asset id. */
  assetId?: string;
  createdAt?: string;
}

export interface SaveDesignResult {
  designId: string;
  status: string;
  title: string;
  currencySymbol: string;
  /** Authoritative amounts from the server. */
  pricing: { basePrice: number; printCost: number; unitPrice: number };
  mockups: { url: string; angle: string; isPrimary: boolean }[];
  /** Listing visibility echoed by the server (private = share-link only after approval). */
  isPrivate?: boolean;
}
