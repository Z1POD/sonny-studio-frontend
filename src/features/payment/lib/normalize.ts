// src/features/payment/lib/normalize.ts
//
// Checkout methods come back camelCase (src/features/checkout/types.ts
// PaymentMethod), order-detail methods come back snake_case with a nested
// `reference` object (src/features/orders/api.ts PaymentMethod). Rather than
// have every consumer duck-type both shapes, normalize once here.

import type { PaymentMethodView } from "../types";

export function normalizePaymentMethod(m: any): PaymentMethodView {
  return {
    providerCode: m.provider_code ?? m.providerCode,
    providerName: m.provider_name ?? m.providerName ?? "",
    providerLogo: m.provider_logo ?? m.providerLogo,
    accountName: m.account_name ?? m.accountName ?? "",
    accountNumber: m.account_number ?? m.accountNumber ?? "",
    accountType: m.account_type ?? m.accountType,
    referenceLabel:
      m.reference?.label ?? m.referenceLabel ?? "Transaction ID / Receipt",
    referencePlaceholder: m.reference?.placeholder ?? m.referencePlaceholder ?? "",
    referenceHelpText: m.reference?.help_text ?? m.referenceHelpText ?? "",
    requiresPayerAccount:
      m.requires_payer_account ??
      m.requires_account_number ??
      m.requiresPayerAccount ??
      false,
    payerAccountLabel:
      m.payer_account_label ??
      m.payerAccountLabel ??
      "Your account number (last 8 digits)",
    supportsUrl: m.supports_url ?? m.supportsUrl ?? false,
    supportsTransactionId: m.supports_transaction_id ?? m.supportsTransactionId ?? true,
  };
}

/**
 * Normalizes the handful of invoice fields AmountBanner needs that differ
 * in casing between the checkout invoice (camelCase) and the order-detail
 * invoice (snake_case). Everything else (amount, items, payment.*) already
 * lines up between the two shapes, so AmountBanner reads those directly.
 */
export function normalizeInvoiceDates(invoice: any) {
  return {
    createdAt: invoice?.createdAt ?? invoice?.created_at,
    expiresAt: invoice?.expiresAt ?? invoice?.expires_at,
  };
}
