// Example payloads for the studio endpoints. They double as the reference responses in STUDIO_API.md
// (run `npm run studio:api-docs` to regenerate the JSON blocks) and as test fixtures.

import type { RawArtworkItem, RawLayer, RawSaveDesignResponse, RawStudioConfig } from "../contract";

const COLORS = [
  { id: "white", name: "Cloud White", hex: "#f4f4f2", in_stock: true },
  { id: "black", name: "Midnight", hex: "#1c1c1e", in_stock: true },
  { id: "sand", name: "Sand", hex: "#d9c9ab", in_stock: true },
  { id: "sage", name: "Sage", hex: "#9fb39a", in_stock: true },
  { id: "navy", name: "Deep Navy", hex: "#22304d", in_stock: true },
  { id: "clay", name: "Clay", hex: "#c0674b", in_stock: false },
];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

/** `GET /studio/products/classic-tee/config/` (a blank: no initial layers). */
export const RAW_STUDIO_CONFIG: RawStudioConfig = {
  id: "9d2f6a52-3b0e-4f0e-9f7e-5a1c2d3e4f50",
  slug: "classic-tee",
  name: "Classic Tee",
  description: "Heavyweight cotton tee, 220 gsm.",
  base_price: "24.00",
  currency: { code: "USD", symbol: "$", decimal_places: 2 },
  model: {
    url: "https://cdn.example.com/models/shirt_baked.glb",
    format: "glb",
    mesh_node: "T_Shirt_male",
    printable_mesh_nodes: null,
    material_name: "lambert1",
    scale: 1,
    position: [0, 0, 0],
    rotation: null,
  },
  scene: {
    light: {
      ambient_intensity: 0.55,
      key: { position: [2.5, 3, 4], intensity: 1.4 },
      rim: { position: [-3, 2, -3], intensity: 0.8 },
    },
    camera: { position: [0, 0.05, 1.7], fov: 28, target: [0, 0.02, 0], min_distance: 0.5, max_distance: 2.6 },
    environment: {
      intensity: 0.7,
      contact_shadow: { opacity: 0.35, blur: 2.6, y: -0.34 },
      auto_rotate_in_preview: true,
      auto_rotate_speed: 1.4,
    },
    background: null,
  },
  colors: COLORS,
  default_color_id: "white",
  variants: {
    options: [{ id: "size", label: "Size", values: SIZES }],
    combinations: COLORS.flatMap((c) =>
      SIZES.map((size) => ({
        variant_id: `var_${c.id}_${size.toLowerCase()}`,
        sku: `TEE-${c.id.toUpperCase()}-${size}`,
        color_id: c.id,
        options: { size },
        in_stock: c.in_stock,
        stock_quantity: c.in_stock ? 120 : 0,
        price_adjustment: size === "XXL" ? "2.00" : "0.00",
      })),
    ),
  },
  print_zones: [
    {
      id: "front",
      label: "Front",
      kind: "decal",
      mesh_node: null,
      projection_depth: null,
      position: [0, 0.04, 0.15],
      rotation: [0, 0, 0],
      size: [0.24, 0.3],
      print_area_cm: [30, 40],
      camera_position: [0, 0.05, 1.7],
      allowed_method_ids: ["dtg", "screen", "embroidery"],
    },
    {
      id: "back",
      label: "Back",
      kind: "decal",
      position: [0, 0.04, -0.13],
      rotation: [0, 3.14159, 0],
      size: [0.24, 0.3],
      print_area_cm: [30, 40],
      camera_position: [0, 0.05, -1.7],
      allowed_method_ids: ["dtg", "screen"],
    },
    {
      id: "left_sleeve",
      label: "Left sleeve",
      kind: "decal",
      position: [0.205, 0.1, 0],
      rotation: [0, 1.5708, -0.75],
      size: [0.07, 0.07],
      print_area_cm: [9, 9],
      camera_position: [1.4, 0.2, 0.2],
      allowed_method_ids: ["dtg", "embroidery"],
    },
    {
      id: "right_sleeve",
      label: "Right sleeve",
      kind: "decal",
      position: [-0.205, 0.1, 0],
      rotation: [0, -1.5708, 0.75],
      size: [0.07, 0.07],
      print_area_cm: [9, 9],
      camera_position: [-1.4, 0.2, 0.2],
      allowed_method_ids: ["dtg", "embroidery"],
    },
    {
      id: "full_wrap",
      label: "Full wrap",
      kind: "wrap",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      size: [1, 1],
      print_area_cm: [150, 80],
      camera_position: [0.9, 0.2, 1.4],
      allowed_method_ids: ["sublimation"],
    },
  ],
  print_methods: [
    { id: "dtg", label: "Direct to garment", description: "Full color, photo-ready prints", min_tier: "standard", max_colors: null, supports_photos: true, price_delta: "0.00" },
    { id: "screen", label: "Screen print", description: "Vivid, durable — up to 4 colors", min_tier: "pro", max_colors: 4, supports_photos: false, price_delta: "4.00" },
    { id: "embroidery", label: "Embroidery", description: "Stitched texture, premium finish", min_tier: "business", max_colors: 6, supports_photos: false, price_delta: "9.00" },
    { id: "sublimation", label: "All-over sublimation", description: "Edge-to-edge print across the whole garment", min_tier: "standard", max_colors: null, supports_photos: true, price_delta: "12.00" },
  ],
  default_print_method_id: "dtg",
  pricing: { extra_zone_price: "5.00" },
  editor: {
    fonts: [
      { id: "sf", label: "SF Pro", family: '-apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif' },
      { id: "serif", label: "New York", family: 'Georgia, "Times New Roman", serif' },
      { id: "mono", label: "SF Mono", family: '"SF Mono", "Courier New", monospace' },
      { id: "impact", label: "Impact", family: 'Impact, "Arial Black", sans-serif' },
      { id: "script", label: "Script", family: '"Brush Script MT", "Segoe Script", cursive' },
    ],
    text_colors: ["#111111", "#ffffff", "#e2366b", "#ff8a3d", "#ffc83d", "#3dbf7a", "#1e5bd8", "#8a8a8e"],
    background_swatches: ["#f5f5f7", "#e8e4dc", "#dfe8ef", "#f3e3e0", "#2c2c2e", "#101014", "#1c2a3a", "#3a2f28"],
    premium_artwork_min_tier: "pro",
    upload: { max_bytes: 20971520, accepted_mime_types: ["image/png", "image/jpeg", "image/svg+xml", "image/webp"] },
  },
  capture: {
    shots: [
      { angle: "front", position: [0, 0.05, 1.6] },
      { angle: "back", position: [0, 0.05, -1.6] },
      { angle: "left", position: [1.6, 0.05, 0] },
      { angle: "right", position: [-1.6, 0.05, 0] },
      { angle: "detail", position: [0.15, 0.1, 0.8] },
    ],
  },
  user_tier: "pro",
  initial_layers: [],
  derived_from_published_product_id: null,
};

/** What `initial_layers` looks like when the studio is opened with `?from=<published slug>`. */
export const RAW_DERIVED_LAYERS: RawLayer[] = [
  {
    id: "init-text",
    kind: "text",
    name: "Headline",
    zone_id: "front",
    visible: true,
    locked: false,
    z_index: 0,
    transform: { x: 0, y: -0.2, scale: 0.12, rotation: 0, opacity: 1 },
    text: {
      content: "Hello, world",
      font_id: "sf",
      font_family: '-apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
      font_weight: 700,
      color: "#111111",
      letter_spacing: 0,
      align: "center",
      italic: false,
    },
  },
  {
    id: "init-art",
    kind: "artwork",
    name: "Sunrise",
    zone_id: "front",
    visible: true,
    locked: false,
    z_index: 1,
    transform: { x: 0, y: 0.35, scale: 0.5, rotation: 0, opacity: 1 },
    image: { src: "https://cdn.example.com/studio/artwork/sunrise.png", artwork_id: "art-sun", asset_id: null },
  },
];

/** `GET /studio/artwork/?category=artwork&page=1&page_size=24` (DRF page envelope). */
export const RAW_ARTWORK_PAGE = {
  count: 4,
  next: null as string | null,
  previous: null as string | null,
  results: [
    { id: "art-sun", name: "Sunrise", category: "artwork", premium: false, src: "https://cdn.example.com/studio/artwork/sunrise.png", thumbnail_url: "https://cdn.example.com/studio/artwork/sunrise_256.png" },
    { id: "art-wave", name: "Wave", category: "artwork", premium: false, src: "https://cdn.example.com/studio/artwork/wave.png", thumbnail_url: "https://cdn.example.com/studio/artwork/wave_256.png" },
    { id: "art-mountain", name: "Peaks", category: "artwork", premium: true, src: "https://cdn.example.com/studio/artwork/peaks.png", thumbnail_url: "https://cdn.example.com/studio/artwork/peaks_256.png" },
    { id: "art-mimo", name: "MIMO Mark", category: "artwork", premium: false, src: "https://cdn.example.com/studio/artwork/mimo.png", thumbnail_url: "https://cdn.example.com/studio/artwork/mimo_256.png" },
  ] satisfies RawArtworkItem[],
};

/** Response of `POST /studio/designs/` and `PUT /studio/designs/{id}/`. */
export const RAW_SAVE_RESPONSE: RawSaveDesignResponse = {
  id: "5b0c3c56-7a54-4c1c-8d0e-0f2f6a0d7c11",
  status: "draft",
  title: "Classic Tee — Custom",
  currency_symbol: "$",
  pricing: { base_price: "24.00", print_cost: "9.00", unit_price: "33.00" },
  mockups: [
    { url: "https://res.cloudinary.com/demo/image/upload/v1/design_mockup/front.png", angle: "front", is_primary: true },
    { url: "https://res.cloudinary.com/demo/image/upload/v1/design_mockup/back.png", angle: "back", is_primary: false },
  ],
};
