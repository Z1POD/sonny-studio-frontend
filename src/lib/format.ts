// src/lib/format.ts

import type { Currency } from "@/types/api";

export const formatPrice = (amount: number | string, currency?: Currency) => {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  const sym = currency?.symbol ?? "";
  const code = currency?.code?.toUpperCase() ?? "";

  // Check if the currency is Ethiopian Birr (by code or symbol text)
  if (sym === "Birr") {
    return `${n.toFixed(2)} ${sym}`;
  }
  else if (sym === "ETB"){
    return `${sym} ${n.toFixed(2)}`;
  }

  // Fallback for all other standard international currency configurations
  return `${sym}${n.toFixed(2)}`;
};

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

// // src/lib/format.ts

// import type { Currency } from "@/types/api";

// export const formatPrice = (amount: number | string, currency?: Currency) => {
//   const n = typeof amount === "string" ? parseFloat(amount) : amount;
//   const sym = currency?.symbol ?? "";
//   return `${sym}${n.toFixed(2)}`;
// };

// export const formatDate = (iso: string) =>
//   new Date(iso).toLocaleDateString(undefined, {
//     month: "short",
//     day: "numeric",
//     year: "numeric",
//   });
