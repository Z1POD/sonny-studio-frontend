// src/lib/telegram-start-param.ts

/**
 * Telegram Mini App `start_param` values are restricted to
 * [A-Za-z0-9_-], so deep-link intent is encoded with a short prefix,
 * e.g. "p_<uuid>" for a product. Add new prefixes here as new
 * deep-link types are introduced (e.g. "c_" for collections).
 */
export type StartParamTarget =
  | { type: "product"; id: string }
  | { type: "route"; path: string };

const PRODUCT_PREFIX = "p_";

/**
 * Plain-word start_params that map to guarded, param-less pages (no detail
 * view — order detail is a modal sheet, not a route). Add new entries here
 * as new top-level deep-linkable sections are introduced.
 */
const ROUTE_PARAMS: Record<string, string> = {
  orders: "/orders",
  store: "/store",
  catalog: "/catalog",
  designs: "/designs",
  wallet: "/wallet",
  analytics: "/analytics",
};

export function parseStartParam(raw: string | null | undefined): StartParamTarget | null {
  if (!raw) return null;
  const value = raw.trim();

  if (value.startsWith(PRODUCT_PREFIX)) {
    const id = value.slice(PRODUCT_PREFIX.length);
    return id ? { type: "product", id } : null;
  }

  const routePath = ROUTE_PARAMS[value.toLowerCase()];
  if (routePath) {
    return { type: "route", path: routePath };
  }

  return null;
}