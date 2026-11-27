import { describe, expect, it } from "vitest";
import { RAW_ARTWORK_PAGE, RAW_DERIVED_LAYERS, RAW_SAVE_RESPONSE, RAW_STUDIO_CONFIG } from "./__fixtures__/studio-api.fixtures";
import {
  buildSaveDesignBody,
  estimatePrice,
  mapArtworkItem,
  mapSaveResponse,
  mapStudioConfig,
  pickDefaultVariant,
  validateForSave,
} from "./contract";
import type { ImageLayer } from "./types";

const product = mapStudioConfig({ ...RAW_STUDIO_CONFIG, initial_layers: RAW_DERIVED_LAYERS });

describe("mapStudioConfig", () => {
  it("maps the whole configurable surface from snake_case", () => {
    expect(product.basePrice).toBe(24);
    expect(product.currencySymbol).toBe("$");
    expect(product.printZones.map((z) => z.id)).toEqual(["front", "back", "left_sleeve", "right_sleeve", "full_wrap"]);
    expect(product.printZones[1]!.allowedMethods).toEqual(["dtg", "screen"]);
    expect(product.printMethods.find((m) => m.id === "screen")?.priceDelta).toBe(4);
    expect(product.pricing.extraZonePrice).toBe(5);
    expect(product.editor.fonts).toHaveLength(5);
    expect(product.capture.shots[0]?.angle).toBe("front");
    expect(product.defaultPrintMethodId).toBe("dtg");
    expect(product.variants.combinations).toHaveLength(36);
  });

  it("restores text layers with the font stack and image layers with their ids", () => {
    const [text, art] = product.initialLayers;
    expect(text).toMatchObject({ kind: "text", text: "Hello, world", fontWeight: 700 });
    expect(art).toMatchObject({ kind: "artwork", artworkId: "art-sun", src: expect.stringContaining("sunrise") });
  });

  it("falls back to sensible defaults when optional blocks are missing", () => {
    const sparse = mapStudioConfig({ ...RAW_STUDIO_CONFIG, capture: undefined, default_print_method_id: null, scene: { ...RAW_STUDIO_CONFIG.scene, background: undefined } });
    expect(sparse.capture.shots).toHaveLength(5);
    expect(sparse.defaultPrintMethodId).toBe("dtg");
    expect(sparse.background).toBeNull();
  });

  it("skips an out-of-stock default colour", () => {
    const cfg = mapStudioConfig({ ...RAW_STUDIO_CONFIG, default_color_id: "clay" });
    expect(cfg.defaultColorId).not.toBe("clay");
  });
});

describe("responses", () => {
  it("maps artwork items", () => {
    expect(mapArtworkItem(RAW_ARTWORK_PAGE.results[2]!)).toEqual({
      id: "art-mountain", name: "Peaks", category: "artwork", premium: true, src: expect.any(String),
    });
  });
  it("maps the save response", () => {
    const r = mapSaveResponse(RAW_SAVE_RESPONSE);
    expect(r.designId).toBe(RAW_SAVE_RESPONSE.id);
    expect(r.pricing).toEqual({ basePrice: 24, printCost: 9, unitPrice: 33 });
    expect(r.mockups[0]?.isPrimary).toBe(true);
  });
});

describe("pricing + validation", () => {
  it("adds method delta and extra-zone surcharge", () => {
    expect(estimatePrice(product, 4, 1)).toBe(28);
    expect(estimatePrice(product, 4, 3)).toBe(38);
  });
  it("requires something to print", () => {
    expect(validateForSave({ product, layers: [], printMethodId: "dtg" })).toMatch(/Add artwork/);
  });
  it("blocks a method the plan or zone doesn't allow", () => {
    expect(validateForSave({ product, layers: product.initialLayers, printMethodId: "embroidery" })).toMatch(/requires the business plan/);
    const back = product.initialLayers.map((l) => ({ ...l, zoneId: "back" }));
    expect(validateForSave({ product, layers: back, printMethodId: "sublimation" })).toMatch(/isn't available on back/);
  });
  it("blocks saving while an upload is in flight or unregistered", () => {
    const up = (extra: Partial<ImageLayer>): ImageLayer => ({
      id: "u1", kind: "upload", name: "logo", zoneId: "front", visible: true, locked: false,
      transform: { x: 0, y: 0, scale: 0.4, rotation: 0, opacity: 1 }, src: "blob:local", ...extra,
    });
    expect(validateForSave({ product, layers: [up({ uploading: true })], printMethodId: "dtg" })).toMatch(/still uploading/);
    expect(validateForSave({ product, layers: [up({})], printMethodId: "dtg" })).toMatch(/wasn't uploaded/);
    expect(validateForSave({ product, layers: [up({ assetId: "a1" })], printMethodId: "dtg" })).toBeNull();
  });
});

describe("buildSaveDesignBody", () => {
  const layers = [
    ...product.initialLayers,
    { ...product.initialLayers[1]!, id: "back-art", zoneId: "back", name: "Back art" },
  ];
  const body = buildSaveDesignBody({
    product, colorId: "navy", printMethodId: "dtg", layers, bgColor: "#101014",
    mockups: [{ assetId: "m1", angle: "front" }, { assetId: "m2", angle: "back" }],
    derivedFrom: "pub-1", estimate: 29, now: new Date("2026-01-01T00:00:00Z"),
  });

  it("organises the complete design by zone, keeping stacking order", () => {
    expect(body.print_zones.map((z) => z.zone_id)).toEqual(["front", "back"]);
    expect(body.print_zones[0]!.layers.map((l) => l.id)).toEqual(["init-text", "init-art"]);
    expect(body.print_zones[1]!.layers[0]).toMatchObject({ id: "back-art", z_index: 2 });
    expect(body.print_zones.every((z) => z.print_method_id === "dtg")).toBe(true);
  });
  it("serialises text styling and image references", () => {
    expect(body.print_zones[0]!.layers[0]!.text).toMatchObject({ content: "Hello, world", font_id: "sf", font_weight: 700 });
    expect(body.print_zones[0]!.layers[1]!.image).toEqual({ artwork_id: "art-sun", asset_id: null });
  });
  it("carries colour, background, variant, mockups and provenance", () => {
    expect(body).toMatchObject({
      schema_version: "studio.v2", product_id: product.id, color_id: "navy", color_hex: "#22304d",
      background_color: "#101014", derived_from_published_product_id: "pub-1", print_method_id: "dtg",
      default_variant_id: "var_navy_xs", client_price_estimate: { amount: "29.00", currency_code: "USD" },
    });
    expect(body.mockups).toEqual([
      { asset_id: "m1", angle: "front", is_primary: true, display_order: 0 },
      { asset_id: "m2", angle: "back", is_primary: false, display_order: 1 },
    ]);
  });
  it("picks an in-stock variant even when the colour is sold out", () => {
    expect(pickDefaultVariant(product, "clay")?.inStock).toBe(true);
  });
});

describe("creator save (listing)", () => {
  const base = {
    product, colorId: "navy", printMethodId: "dtg", layers: product.initialLayers, bgColor: null as string | null,
    mockups: [{ assetId: "m1", angle: "front" as const }], derivedFrom: null, estimate: 29, now: new Date("2026-01-01T00:00:00Z"),
  };
  it("creates a listing draft with a title", () => {
    const b = buildSaveDesignBody({ ...base, app: "creator-studio", purpose: "listing" });
    expect(b).toMatchObject({ purpose: "listing", client: { app: "creator-studio" } });
    expect(b.title).toContain(product.name);
  });
  it("never resends the title/description on update, so a renamed design keeps its name", () => {
    const b = buildSaveDesignBody({ ...base, app: "creator-studio", purpose: "listing", isUpdate: true });
    expect("title" in b).toBe(false);
    expect("description" in b).toBe(false);
  });
  it("sends the chosen garment colour so the saved photos and the re-opened scene agree", () => {
    const b = buildSaveDesignBody({ ...base, colorId: "navy" });
    expect(b).toMatchObject({ color_id: "navy", color_hex: "#22304d" });
  });
  it("maps the creator's own uploads and the editing id", () => {
    expect(mapArtworkItem({ id: "a1", name: "Logo", category: "mine", src: "https://x/y.png", premium: false, asset_id: "as1" })).toMatchObject({ category: "mine", assetId: "as1" });
    expect(mapStudioConfig({ ...RAW_STUDIO_CONFIG, initial_layers: [], editing_design_id: "d-9" }).editingDesignId).toBe("d-9");
    expect(product.editingDesignId).toBeNull();
  });
});

describe("print method ids", () => {
  it("uses the UUID (not the code) for print_method_id when the payload carries both", async () => {
    const { mapStudioConfig } = await import("./contract");
    const { RAW_STUDIO_CONFIG } = await import("./__fixtures__/studio-api.fixtures");
    const uuid = "3f2b8c1e-5d4a-4b6e-9a7c-1d2e3f4a5b6c";
    const raw = structuredClone(RAW_STUDIO_CONFIG) as any;
    raw.print_methods[0] = { ...raw.print_methods[0], id: uuid, code: "dtg" };
    raw.print_zones.forEach((z: any) => (z.allowed_method_ids = z.allowed_method_ids.map((i: string) => (i === "dtg" ? "dtg" : i))));
    raw.default_print_method_id = "dtg";
    const cfg = mapStudioConfig(raw);
    expect(cfg.printMethods[0]!.id).toBe(uuid);
    expect(cfg.defaultPrintMethodId).toBe(uuid);
    expect(cfg.printZones[0]!.allowedMethods).toContain(uuid);
  });
});

describe("print method uuid discovery", () => {
  it("finds the UUID under any key when `id` is the code", async () => {
    const { printMethodUuid } = await import("./contract");
    const uuid = "3f2b8c1e-5d4a-4b6e-9a7c-1d2e3f4a5b6c";
    expect(printMethodUuid({ id: "dtg", method_uuid: uuid } as any)).toBe(uuid);
    expect(printMethodUuid({ id: "dtg" } as any)).toBe("dtg");
  });
});

describe("print zone ids", () => {
  it("keeps the zone UUID as id and exposes the code as a hint", async () => {
    const { mapZone } = await import("./contract");
    const raw = { ...RAW_STUDIO_CONFIG.print_zones[0]!, id: "1ddf6a4a-c28c-46ec-bf9e-085edb38ff2c", code: "front" };
    expect(mapZone(raw)).toMatchObject({ id: "1ddf6a4a-c28c-46ec-bf9e-085edb38ff2c", code: "front" });
  });
});

describe("optional scene rotation + model material", () => {
  it("maps polar limits, rotation and material when the backend sends them", async () => {
    const { mapStudioConfig } = await import("./contract");
    const raw = structuredClone(RAW_STUDIO_CONFIG) as any;
    raw.scene.camera.min_polar_angle = 1.25;
    raw.scene.camera.max_polar_angle = 1.85;
    raw.scene.rotation = { allow_360: true, auto_rotate_in_edit: false, rotate_speed: 0.8, min_azimuth_angle: null, max_azimuth_angle: null, min_polar_angle: 1.3, max_polar_angle: 1.8 };
    raw.model.material = { roughness: 0.85, metalness: 0.05, env_map_intensity: 1, repeat: [2, 2], maps: { map_url: null, normal_map_url: "https://x/n.png", roughness_map_url: null, ao_map_url: null } };
    const cfg = mapStudioConfig(raw);
    expect(cfg.camera).toMatchObject({ minPolarAngle: 1.25, maxPolarAngle: 1.85 });
    expect(cfg.rotation).toMatchObject({ allow360: true, autoRotateInEdit: false, rotateSpeed: 0.8, minPolarAngle: 1.3, maxPolarAngle: 1.8 });
    expect(cfg.rotation).not.toHaveProperty("minAzimuthAngle");
    expect(cfg.model.material).toEqual({ roughness: 0.85, metalness: 0.05, envMapIntensity: 1, repeat: [2, 2], maps: { normalMap: "https://x/n.png" } });
  });
  it("leaves everything undefined when absent (old behaviour)", async () => {
    const { mapStudioConfig } = await import("./contract");
    const cfg = mapStudioConfig(structuredClone(RAW_STUDIO_CONFIG));
    expect(cfg.rotation).toBeUndefined();
    expect(cfg.model.material).toBeUndefined();
    expect(cfg.camera.minPolarAngle).toBeUndefined();
  });
});
