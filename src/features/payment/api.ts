// src/features/payment/api.ts
//
// Payment endpoints of the Buyer Frontend API:
//   GET  /payments/orders/{id}/methods/        payment methods for an order
//   POST /payments/attempts/                   create an attempt (idempotent)
//   POST /payments/attempts/{id}/receipt/      attach an uploaded receipt asset
//   POST /payments/attempts/{id}/verify/       verify (owner only)
//   GET  /payments/orders/{id}/attempts/       attempts for an order

import { api } from "@/shared/api/client";

export interface MerchantAccount {
  accountName: string;
  accountNumber: string;
  shortCode: string;
  accountType: string;
}

/** Everything the payment form needs is data-driven from the method (contract §17.1). */
export interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  kind: string;
  description: string;
  instructions: string;
  logoUrl: string | null;
  currencyCode: string;
  feeAmount: string;
  feeIsPercentage: boolean;
  supportsScreenshot: boolean;
  supportsUrl: boolean;
  supportsTransactionId: boolean;
  requiresAccountNumber: boolean;
  receiptLabel: string;
  receiptPlaceholder: string;
  receiptHelpText: string;
  accountLabel: string;
  estimatedProcessingHours: number | null;
  /** Where the buyer sends the money. */
  merchantAccounts: MerchantAccount[];
  /** Extra display facts (bank name, branch, holder…). */
  display: Record<string, string>;
}

/** verified · pending_review (manual review) · failed / rejected (→ order payment_failed) · initiated · receipt_submitted */
export type AttemptStatus = "initiated" | "receipt_submitted" | "verified" | "pending_review" | "failed" | "rejected" | (string & {});

export interface PaymentAttempt {
  id: string;
  orderId: string;
  status: AttemptStatus;
  amount: string;
  receiptIdentifier: string;
  payerAccount: string;
  hasReceipt: boolean;
  verificationMessage: string;
}

interface RawMethod {
  id: string;
  code: string;
  name: string;
  kind: string;
  description?: string;
  instructions?: string;
  logo_url?: string | null;
  currency_code: string;
  fee_amount: string;
  fee_is_percentage: boolean;
  supports_screenshot?: boolean;
  supports_url?: boolean;
  supports_transaction_id?: boolean;
  requires_account_number?: boolean;
  receipt_label?: string;
  receipt_placeholder?: string;
  receipt_help_text?: string;
  account_label?: string;
  estimated_processing_hours?: number | null;
  merchant_accounts?: { account_name?: string; account_number?: string; short_code?: string; account_type?: string }[];
  display?: Record<string, unknown>;
}

interface RawAttempt {
  id: string;
  order: string;
  status: string;
  amount: string;
  receipt_identifier?: string;
  payer_account?: string;
  receipt_asset: unknown;
  verification_message: string;
}

const mapMethod = (m: RawMethod): PaymentMethod => ({
  id: m.id,
  code: m.code,
  name: m.name,
  kind: m.kind,
  description: m.description ?? "",
  instructions: m.instructions ?? "",
  logoUrl: m.logo_url ?? null,
  currencyCode: m.currency_code,
  feeAmount: m.fee_amount,
  feeIsPercentage: m.fee_is_percentage,
  supportsScreenshot: m.supports_screenshot ?? false,
  supportsUrl: m.supports_url ?? false,
  supportsTransactionId: m.supports_transaction_id ?? false,
  requiresAccountNumber: m.requires_account_number ?? false,
  receiptLabel: m.receipt_label || "Transaction reference",
  receiptPlaceholder: m.receipt_placeholder ?? "",
  receiptHelpText: m.receipt_help_text ?? "",
  accountLabel: m.account_label || "Account number",
  estimatedProcessingHours: m.estimated_processing_hours ?? null,
  merchantAccounts: (m.merchant_accounts ?? []).map((a) => ({
    accountName: a.account_name ?? "",
    accountNumber: a.account_number ?? "",
    shortCode: a.short_code ?? "",
    accountType: a.account_type ?? "",
  })),
  display: Object.fromEntries(Object.entries(m.display ?? {}).map(([k, v]) => [k, String(v)])),
});

const mapAttempt = (a: RawAttempt): PaymentAttempt => ({
  id: a.id,
  orderId: a.order,
  status: a.status,
  amount: a.amount,
  receiptIdentifier: a.receipt_identifier ?? "",
  payerAccount: a.payer_account ?? "",
  hasReceipt: a.receipt_asset != null,
  verificationMessage: a.verification_message,
});

export const paymentApi = {
  methods: async (orderId: string): Promise<PaymentMethod[]> =>
    (await api.get<RawMethod[]>(`/payments/orders/${orderId}/methods/`)).map(mapMethod),

  createAttempt: async (p: {
    orderId: string;
    methodId: string;
    idempotencyKey: string;
    receiptIdentifier?: string;
    payerAccount?: string;
    receiptAssetId?: string;
  }) =>
    mapAttempt(
      await api.post<RawAttempt>("/payments/attempts/", {
        body: {
          order_id: p.orderId,
          payment_method_id: p.methodId,
          idempotency_key: p.idempotencyKey,
          ...(p.receiptIdentifier ? { receipt_identifier: p.receiptIdentifier } : {}),
          ...(p.payerAccount ? { payer_account: p.payerAccount } : {}),
          ...(p.receiptAssetId ? { receipt_asset_id: p.receiptAssetId } : {}),
        },
      }),
    ),

  /** Alternative input: attach a screenshot to an existing attempt. */
  attachReceipt: async (attemptId: string, receiptAssetId: string) =>
    mapAttempt(await api.post<RawAttempt>(`/payments/attempts/${attemptId}/receipt/`, { body: { receipt_asset_id: receiptAssetId } })),

  verify: async (attemptId: string) =>
    mapAttempt(await api.post<RawAttempt>(`/payments/attempts/${attemptId}/verify/`, { body: {} })),

  attempts: async (orderId: string): Promise<PaymentAttempt[]> =>
    (await api.get<RawAttempt[]>(`/payments/orders/${orderId}/attempts/`)).map(mapAttempt),
};
