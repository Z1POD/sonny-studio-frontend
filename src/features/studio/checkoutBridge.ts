// src/features/studio/checkoutBridge.ts
//
// Saved studio design → params for the checkout store (`useCheckoutStore.open`).

import type { CheckoutOpenParams } from "@/features/checkout/store";
import { pickDefaultVariant } from "./contract";
import type { Layer, MockupCapture, ProductConfig, SaveDesignResult } from "./types";

export function toCheckoutParams(opts: {
  product: ProductConfig;
  colorId: string;
  layers: Layer[];
  result: SaveDesignResult;
  captures: MockupCapture[];
  userFullName: string;
}): CheckoutOpenParams {
  const { product, result, captures } = opts;
  const color = product.colors.find((c) => c.id === opts.colorId);
  const variant = pickDefaultVariant(product, opts.colorId);

  const serverMockups = result.mockups.map((m) => m.url);
  const primary = result.mockups.find((m) => m.isPrimary)?.url ?? serverMockups[0] ?? captures[0]?.dataUrl;

  // One entry per printed zone, for checkout's "what's printed" summary.
  const printed = opts.layers.filter((l) => l.visible && l.transform.opacity > 0);
  const printAreas = product.printZones
    .filter((z) => printed.some((l) => l.zoneId === z.id))
    .map((z) => ({ id: z.id, name: z.label }));
  const artworks = Object.fromEntries(
    printAreas.map((z) => {
      const img = printed.find((l) => l.zoneId === z.id && l.kind !== "text");
      return [z.id, { decalUrl: (img && "src" in img ? img.src : "") || primary || "" }];
    }),
  );

  return {
    userFullName: opts.userFullName,
    // The saved design is what gets ordered.
    productId: result.designId,
    productName: result.title || product.name,
    thumbnailUrl: primary,
    mockupUrl: primary,
    mockupUrls: serverMockups.length ? serverMockups : captures.map((c) => c.dataUrl),
    basePrice: result.pricing.basePrice,
    printCost: result.pricing.printCost,
    currencySymbol: result.currencySymbol || product.currencySymbol,
    variants: product.variants.combinations.map((c) => {
      const col = product.colors.find((x) => x.id === c.colorId);
      return {
        id: c.variantId,
        sku: c.sku,
        color: { name: col?.name ?? "Default", hex: col?.hex ?? "#cccccc" },
        size: c.options["size"] ?? Object.values(c.options)[0] ?? "One size",
        stockQuantity: c.stockQuantity,
        isInStock: c.inStock,
        additionalPrice: c.priceAdjustment,
        quantity: 1,
      };
    }),
    artworks,
    printAreas,
    selectedColor: color?.hex,
    preselectedVariantId: variant?.variantId,
  };
}
