// src/features/payment/lib/paymentValidation.ts

import type { ReceiptFieldType } from "../types";

export function validateReceiptField(
  value: string,
  type: ReceiptFieldType
): string | null {
  const v = value.trim();
  if (!v) return "This field is required.";

  switch (type) {
    case "urlOrTransactionId":
      try {
        const u = new URL(v);
        if (["http:", "https:"].includes(u.protocol)) return null;
      } catch {}
      if (/^[A-Za-z0-9\-_]{4,64}$/.test(v)) return null;
      return "Enter a valid receipt URL or transaction ID.";

    case "alphanumeric":
      if (!/^[A-Za-z0-9\-_]{4,64}$/.test(v)) {
        return "Enter a valid transaction ID (letters and numbers only, 4–64 characters).";
      }
      return null;

    case "url":
      try {
        const u = new URL(v);
        if (!["http:", "https:"].includes(u.protocol)) {
          return "Enter a valid https:// URL.";
        }
        return null;
      } catch {
        return "Enter a valid URL (e.g. https://…).";
      }

    default:
      return null;
  }
}

export function validatePayerAccount(value: string): string | null {
  const v = value.trim();
  if (!v) return "This field is required.";
  if (!/^\d{4,12}$/.test(v))
    return "Enter the last digits of your account number (numbers only).";
  return null;
}
