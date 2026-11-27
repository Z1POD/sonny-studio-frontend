// Example payloads for the public marketplace endpoints. They double as the reference responses in
// API_CONTRACT.md (`npm run api-docs` regenerates the JSON) and as test fixtures.

import type { RawPublishedDetail, RawPublishedListItem } from "../contract";
import { RAW_STUDIO_CONFIG } from "../../studio/__fixtures__/studio-api.fixtures";

const CDN = "https://cdn.example.com";
const money = (amount: string) => ({ amount, currency_code: "USD", currency_symbol: "$", currency_decimal_places: 2 });

export const RAW_LIST_ITEM: RawPublishedListItem = {
  id: "6f1e0f3a-0000-4000-8000-000000000001",
  slug: "sunrise-tee",
  title: "Sunrise Tee",
  description: "A warm sunrise over a heavyweight cotton tee.",
  mockup_url: `${CDN}/mockups/sunrise-black-front.png`,
  price: money("29.00"),
  owner: { id: 42, display_name: "Mara Studio", avatar_url: `${CDN}/avatars/mara.png` },
  blank_product_id: RAW_STUDIO_CONFIG.id,
  sold_quantity: 128,
  view_count: 5230,
  in_stock: true,
  allows_customization_on_top: true,
  is_active: true,
  published_at: "2026-10-01T09:30:00Z",
};

const COLORS = [
  { id: "c-black", code: "black", name: "Midnight", hex: "#1c1c1e", sort_order: 0 },
  { id: "c-white", code: "white", name: "Cloud White", hex: "#f4f4f2", sort_order: 1 },
  { id: "c-sage", code: "sage", name: "Sage", hex: "#9fb39a", sort_order: 2 },
  { id: "c-navy", code: "navy", name: "Deep Navy", hex: "#22304d", sort_order: 3 },
];
const SIZES = [
  { id: "s-s", code: "s", label: "S", sort_order: 0 },
  { id: "s-m", code: "m", label: "M", sort_order: 1 },
  { id: "s-l", code: "l", label: "L", sort_order: 2 },
  { id: "s-xl", code: "xl", label: "XL", sort_order: 3 },
];

// Stock by colour → size (null = not tracked, 0 = sold out).
const STOCK: Record<string, Record<string, number | null>> = {
  "c-black": { "s-s": 3, "s-m": null, "s-l": 0, "s-xl": 40 },
  "c-white": { "s-s": 20, "s-m": 20, "s-l": 20, "s-xl": 20 },
  "c-sage": { "s-s": 0, "s-m": 8, "s-l": 0, "s-xl": 0 },
  "c-navy": { "s-s": 0, "s-m": 0, "s-l": 0, "s-xl": 0 },
};

const combinations = COLORS.flatMap((c) =>
  SIZES.map((s) => {
    const stock = STOCK[c.id]![s.id]!;
    return {
      variant_id: `var-${c.code}-${s.code}`,
      sku: `SUN-${c.code.toUpperCase()}-${s.code.toUpperCase()}`,
      color_id: c.id,
      size_id: s.id,
      available: stock === null || stock > 0,
      stock_quantity: stock,
      price: s.code === "xl" ? "31.00" : "29.00",
    };
  }),
);

const mockup = (id: string, color: string | null, label: string, order: number, primary = false) => ({
  id,
  url: `${CDN}/mockups/sunrise-${color ?? "all"}-${label}.png`,
  thumbnail_url: `${CDN}/mockups/sunrise-${color ?? "all"}-${label}_256.png`,
  label,
  color_id: color ? `c-${color}` : null,
  is_primary: primary,
  display_order: order,
});

/** `GET /products/published/sunrise-tee/` */
export const RAW_PUBLISHED_DETAIL: RawPublishedDetail = {
  ...RAW_LIST_ITEM,
  design: {
    id: "d3b1c2a4-0000-4000-8000-0000000000d1",
    blank_product_id: RAW_STUDIO_CONFIG.id,
    blank_product_slug: "classic-tee",
    blank_product_name: "Classic Tee",
    default_variant_id: "var-black-m",
  },
  variant_matrix: { colors: COLORS, sizes: SIZES, combinations },
  mockups: [
    mockup("mk1", "black", "front", 0, true),
    mockup("mk2", "black", "back", 1),
    mockup("mk3", "white", "front", 2, true),
    mockup("mk4", "white", "back", 3),
    mockup("mk5", null, "detail", 4),
  ],
  viewer_3d: {
    model: RAW_STUDIO_CONFIG.model,
    scene: RAW_STUDIO_CONFIG.scene,
    print_zones: RAW_STUDIO_CONFIG.print_zones,
    layers: [
      {
        id: "L1",
        kind: "artwork",
        name: "Sunrise",
        zone_id: "front",
        visible: true,
        locked: false,
        z_index: 0,
        transform: { x: 0, y: 0.1, scale: 0.5, rotation: 0, opacity: 1 },
        image: { src: `${CDN}/studio/artwork/sunrise.png`, artwork_id: "art-sun" },
      },
      {
        id: "L2",
        kind: "text",
        name: "Sunrise",
        zone_id: "front",
        visible: true,
        locked: false,
        z_index: 1,
        transform: { x: 0, y: -0.45, scale: 0.12, rotation: 0, opacity: 1 },
        text: {
          content: "SUNRISE CLUB",
          font_id: "impact",
          font_family: 'Impact, "Arial Black", sans-serif',
          font_weight: 700,
          color: "#ff8a3d",
          letter_spacing: 4,
          align: "center",
          italic: false,
        },
      },
    ],
  },
  details: { name: "Classic Tee", brand: "MIMO Basics", fit: "Regular", material: "100% combed cotton", weight_grams: 220, care_instructions: "Machine wash cold, inside out" },
  tags: ["sunrise", "graphic tee"],
  stats: { view_count: 5230, sold_quantity: 128 },
  related_products: [{ ...RAW_LIST_ITEM, id: "6f1e0f3a-0000-4000-8000-000000000002", slug: "wave-tee", title: "Wave Tee", mockup_url: `${CDN}/mockups/wave-white-front.png`, price: money("27.00") }],
};
