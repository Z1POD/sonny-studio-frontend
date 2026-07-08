// src/lib/telegram-start-param.ts

/**
 * Telegram Mini App `start_param` values are restricted to
 * [A-Za-z0-9_-], so deep-link intent is encoded with a short prefix,
 * e.g. "p_<uuid>" for a product. Add new prefixes here as new
 * deep-link types are introduced (e.g. "c_" for collections).
 */
export type StartParamTarget = { type: "product"; id: string };

const PRODUCT_PREFIX = "p_";

export function parseStartParam(raw: string | null | undefined): StartParamTarget | null {
  if (!raw) return null;
  const value = raw.trim();

  if (value.startsWith(PRODUCT_PREFIX)) {
    const id = value.slice(PRODUCT_PREFIX.length);
    return id ? { type: "product", id } : null;
  }

  return null;
}