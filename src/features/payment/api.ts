// src/features/payment/api.ts
//
// Canonical client for the two payment-verification endpoints. This is the
// single source of truth for the /payment/submit-receipt/ and /payment/verify/
// contract (including `is_terminal`, which lets the caller skip polling when
// the backend already resolved the receipt synchronously).
//
// src/features/checkout/api.ts re-exports `paymentApi` from here for
// backward compatibility. src/features/orders/api.ts's own
// submitReceipt/verifyPayment are legacy and predate `is_terminal` support —
// prefer this module for any new payment-verification work.

import { api } from "@/shared/api/client";
import type { ReceiptSubmissionResult, VerificationStatus } from "./types";

export interface SubmitReceiptPayload {
  order_id: string;
  provider: string;
  receipt_identifier: string;
  payer_account?: string;
}

interface SubmitReceiptApiResponse {
  success: boolean;
  data: {
    transaction_id: string;
    status: string;
    status_display: string;
    is_verified: boolean;
    is_terminal: boolean;
    message: string;
    error_message: string | null;
    amount: string;
    currency: string;
    provider: string;
    submitted_at: string;
    verified_at: string | null;
    order_status: string;
    order_payment_status: string;
  };
}

interface VerifyApiResponse {
  success: boolean;
  data: {
    transaction_id: string;
    status: VerificationStatus["status"];
    status_display: string;
    is_verified: boolean;
    is_terminal: boolean;
    amount: string;
    currency: string;
    provider: string;
    receipt_identifier: string;
    error_message?: string;
    submitted_at: string;
    verified_at?: string;
  };
}

export const paymentApi = {
  /**
   * POST /api/v1/payment/submit-receipt/
   * Backend verifies synchronously — `isTerminal` tells the caller whether
   * to render the result immediately or start polling `verify`.
   */
  submitReceipt: async (payload: SubmitReceiptPayload): Promise<ReceiptSubmissionResult> => {
    const res = await api.post<SubmitReceiptApiResponse>("/payment/submit-receipt/", {
      body: payload,
    });
    const d = res.data;
    return {
      transactionId: d.transaction_id,
      status: d.status,
      statusDisplay: d.status_display,
      isVerified: d.is_verified,
      isTerminal: d.is_terminal,
      amount: d.amount,
      currency: d.currency,
      provider: d.provider,
      errorMessage: d.error_message ?? undefined,
      submittedAt: d.submitted_at,
      verifiedAt: d.verified_at ?? undefined,
    };
  },

  /**
   * POST /api/v1/payment/verify/
   * Polling endpoint — only called when submitReceipt returned isTerminal = false.
   */
  verify: async (txRef: string): Promise<VerificationStatus> => {
    const res = await api.post<VerifyApiResponse>("/payment/verify/", {
      body: { tx_ref: txRef },
    });
    const d = res.data;
    return {
      transactionId: d.transaction_id,
      status: d.status,
      statusDisplay: d.status_display,
      isVerified: d.is_verified,
      isTerminal: d.is_terminal,
      amount: d.amount,
      currency: d.currency,
      provider: d.provider,
      receiptIdentifier: d.receipt_identifier,
      errorMessage: d.error_message,
      submittedAt: d.submitted_at,
      verifiedAt: d.verified_at,
    };
  },
};
