import { describe, expect, it } from "vitest";
import { RAW_LIST_ITEM, RAW_PUBLISHED_DETAIL } from "./__fixtures__/market-api.fixtures";
import { findVariant, mapPublishedDetail, mapPublishedListItem, mockupsForColor } from "./contract";

const p = mapPublishedDetail(RAW_PUBLISHED_DETAIL);

describe("mapPublishedDetail", () => {
  it("opens on the suggested variant's colour and keeps the colour order", () => {
    expect(p.colors.map((c) => c.id)).toEqual(["c-black", "c-white", "c-sage", "c-navy"]);
    expect(p.default_variant_id).toBe("var-black-m");
  });
  it("gives each colour its own sizes with availability", () => {
    const black = p.colors[0]!;
    expect(black.sizes.map((s) => [s.label, s.available])).toEqual([["S", true], ["M", true], ["L", false], ["XL", true]]);
    const sage = p.colors.find((c) => c.id === "c-sage")!;
    expect(sage.sizes.filter((s) => s.available).map((s) => s.label)).toEqual(["M"]);
  });
  it("flags a colour with no buyable size as unavailable (still listed)", () => {
    expect(p.colors.find((c) => c.id === "c-navy")?.available).toBe(false);
  });
  it("uses per-variant price and the lowest available price as 'From'", () => {
    expect(findVariant(p, "c-black", "s-xl")?.price).toBe("31.00");
    expect(p.pricing.retail_price).toBe("29.00");
    expect(p.pricing.currency).toMatchObject({ symbol: "$", decimal_places: 2 });
  });
  it("treats stock_quantity 0 as unavailable and null as untracked", () => {
    expect(findVariant(p, "c-black", "s-l")?.available).toBe(false);
    expect(findVariant(p, "c-black", "s-m")).toMatchObject({ available: true, stock_quantity: null });
  });
  it("maps stats, details and the 3D bundle", () => {
    expect(p.stats).toEqual({ view_count: 5230, sold_quantity: 128 });
    expect(p.details.material).toBe("100% combed cotton");
    expect(p.viewer3d?.layers).toHaveLength(2);
    expect(p.viewer3d?.printZones[0]?.id).toBe("front");
  });
  it("has no 3D when viewer_3d is absent", () => {
    expect(mapPublishedDetail({ ...RAW_PUBLISHED_DETAIL, viewer_3d: null }).viewer3d).toBeNull();
  });
  it("maps related products as list items", () => {
    expect(p.related_products[0]).toMatchObject({ slug: "wave-tee", retail_price: "27.00", kind: "published" });
  });
});

describe("allows_customization_on_top", () => {
  it("is carried through so the 'Personalize this design' action can be gated", () => {
    expect(mapPublishedDetail({ ...RAW_PUBLISHED_DETAIL, allows_customization_on_top: false }).allows_customization_on_top).toBe(false);
    expect(mapPublishedDetail({ ...RAW_PUBLISHED_DETAIL, allows_customization_on_top: true }).allows_customization_on_top).toBe(true);
  });
  it("defaults to not allowed when the server omits it", () => {
    const { allows_customization_on_top: _omit, ...rest } = RAW_PUBLISHED_DETAIL;
    expect(mapPublishedDetail(rest as typeof RAW_PUBLISHED_DETAIL).allows_customization_on_top).toBe(false);
  });
});

describe("mockupsForColor", () => {
  it("shows the colour's photos plus colour-agnostic ones, in order", () => {
    expect(mockupsForColor(p.mockups, "c-white").map((m) => m.id)).toEqual(["mk3", "mk4", "mk5"]);
  });
  it("falls back to colour-agnostic photos when the colour has none", () => {
    expect(mockupsForColor(p.mockups, "c-sage").map((m) => m.id)).toEqual(["mk5"]);
  });
  it("falls back to everything when nothing is colour-agnostic", () => {
    const only = p.mockups.filter((m) => m.color_id);
    expect(mockupsForColor(only, "c-sage")).toHaveLength(only.length);
  });
});

describe("mapPublishedListItem", () => {
  it("maps price, owner and sold-out state", () => {
    const i = mapPublishedListItem({ ...RAW_LIST_ITEM, in_stock: false });
    expect(i).toMatchObject({ retail_price: "29.00", store: { name: "Mara Studio", slug: "42" }, available_quantity: 0 });
  });
});

describe("variant matrix with `options` maps", () => {
  it("derives colour/size from options when flat ids are absent, so sizes and stock show", () => {
    const raw = structuredClone(RAW_PUBLISHED_DETAIL) as any;
    raw.variant_matrix = {
      colors: [{ id: "black", code: "black", name: "Black", hex: "#000000" }],
      sizes: [{ id: "m", code: "m", label: "Medium" }, { id: "l", code: "l", label: "Large" }],
      combinations: [
        { variant_id: "v1", sku: "A-M", color_id: "black", options: { color: "black", size: "m" }, available: true, stock_quantity: null, price: "10.00" },
        { variant_id: "v2", sku: "A-L", color_id: "black", options: { color: "black", size: "l" }, available: true, stock_quantity: null, price: "10.00" },
      ],
    };
    raw.variant_matrix.combinations.forEach((c: any) => delete c.size_id);
    const d = mapPublishedDetail(raw);
    expect(d.colors[0]!.available).toBe(true);
    expect(d.colors[0]!.sizes.map((s) => s.id)).toEqual(["m", "l"]);
    expect(d.colors[0]!.sizes.every((s) => s.available)).toBe(true);
  });
});
