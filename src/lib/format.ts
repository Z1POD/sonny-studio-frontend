// src/lib/format.ts

/** Anything carrying display info for a currency (contract: `symbol`, `decimal_places`). */
export interface CurrencyLike {
  code?: string;
  symbol?: string;
  decimal_places?: number;
}

/**
 * Formats a server amount for display. Uses the currency's own fraction digits (default 2) — never rounds to
 * whole units — and a space between an alphabetic symbol/code and the number ("ETB 450.00"), none for "$".
 */
export const formatPrice = (amount: number | string | null | undefined, currency?: CurrencyLike | string | null) => {
  const n = typeof amount === "string" ? parseFloat(amount) : (amount ?? NaN);
  const cur: CurrencyLike = typeof currency === "string" ? { symbol: currency } : (currency ?? {});
  const sym = cur.symbol || cur.code || "";
  if (!Number.isFinite(n)) return "—";
  const digits = cur.decimal_places ?? 2;
  const num = n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (!sym) return num;
  return /[A-Za-z]$/.test(sym) ? `${sym} ${num}` : `${sym}${num}`;
};

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
