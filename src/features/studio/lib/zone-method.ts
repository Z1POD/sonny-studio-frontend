import type { PrintZone, ProductConfig } from "../types";

/**
 * The print method a zone will use: the one picked for that zone, else the design's default method when the zone
 * allows it, else the first method the zone allows.
 */
export function resolveZoneMethod(zone: PrintZone, picks: Record<string, string>, fallback: string): string {
  const picked = picks[zone.id];
  if (picked && zone.allowedMethods.includes(picked)) return picked;
  if (zone.allowedMethods.includes(fallback)) return fallback;
  return zone.allowedMethods[0] ?? fallback;
}

/** Resolved method per zone id, for every zone of the product. */
export function resolveAllZoneMethods(product: ProductConfig, picks: Record<string, string>, fallback: string): Record<string, string> {
  return Object.fromEntries(product.printZones.map((z) => [z.id, resolveZoneMethod(z, picks, fallback)]));
}
