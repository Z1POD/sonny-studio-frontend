// src/features/payment/types.ts
//
// Shared, backend-shape-agnostic types for the payment-verification flow.
// Both the checkout invoice/methods (camelCase, from src/features/checkout/types.ts)
// and the order-detail invoice/methods (snake_case, from src/features/orders/api.ts)
// get normalized into these shapes before reaching the shared components/hooks.

export type ReceiptFieldType = "alphanumeric" | "url" | "urlOrTransactionId";

export interface PaymentMethodView {
  providerCode: string;
  providerName: string;
  providerLogo?: string;
  accountName: string;
  accountNumber: string;
  accountType?: string;
  referenceLabel: string;
  referencePlaceholder: string;
  referenceHelpText: string;
  requiresPayerAccount: boolean;
  payerAccountLabel?: string;
  supportsUrl: boolean;
  supportsTransactionId: boolean;
}

export interface ReceiptSubmissionResult {
  transactionId: string;
  status: string;
  statusDisplay: string;
  isVerified: boolean;
  isTerminal: boolean;
  amount: string;
  currency: string;
  provider: string;
  errorMessage?: string;
  submittedAt: string;
  verifiedAt?: string;
}

export interface VerificationStatus {
  transactionId: string;
  status: "submitted" | "verifying" | "verified" | "mismatch" | "failed";
  statusDisplay: string;
  isVerified: boolean;
  isTerminal: boolean;
  amount: string;
  currency: string;
  provider: string;
  receiptIdentifier: string;
  errorMessage?: string;
  submittedAt: string;
  verifiedAt?: string;
}
