// src/lib/format.ts

import type { Currency } from "@/shared/api/types";

export const formatPrice = (amount: number | string, currency?: Currency) => {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  const sym = currency?.symbol ?? "";

  const formatted = Math.round(n).toLocaleString("en-US");

  // Check if the currency is Ethiopian Birr (by code or symbol text)
  if (sym === "Birr") {
    return `${n.toFixed(1)} ${sym}`;
  }
  else if (sym === "ETB") {
    return `${sym} ${formatted}`;
  }
  else if (sym === "$") {
    return `${sym}${formatted}`;
  }

  // Fallback for all other standard international currency configurations
  return `${sym} ${formatted}`;
};


export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });


