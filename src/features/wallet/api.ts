/**
 * src/features/wallet/api.ts
 *
 * Wallet API — fully aligned to backend contract.
 */

import { api } from "@/shared/api/client";

//     Paging ──────────────────────────────────────────────────────────────────
// Wallet lists answer `{ count, page, page_size, results }` (page_size max 100); the generic DRF
// `next` link is also honoured when present.

export interface Paged<T> {
  count: number;
  page?: number;
  page_size?: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

export const hasMorePages = (p: Paged<unknown>, loaded: number): boolean =>
  p.next != null ? true : p.page != null && p.page_size ? p.page * p.page_size < p.count : loaded < p.count;

//     Shared shapes                                                             

import type { Currency } from "@/shared/api/types";

export type { Currency };

export interface WalletBalance {
  available: string;
  pending: string;
  total: string;
  total_earned: string;
  total_withdrawn: string;
  currency: Currency;
}

export interface WalletDetail {
  id: string;
  status: string;
  balance: WalletBalance;
  currency: Currency;
  total_earned: string;
  total_withdrawn: string;
  total_platform_fees_paid: string;
  auto_withdrawal: boolean;
  auto_withdrawal_threshold: string | null;
  withdrawal_schedule: string;
  withdrawal_methods: WithdrawalMethod[];
  recent_transactions: LedgerTransaction[];
  created_at: string;
  updated_at: string;
}

/**
 * A payout rail (catalog, §4.4). Its fee/limits are INFORMATIONAL: the admin can override them
 * platform-wide at request time, so the fee actually charged is the `fee_amount` the server returns.
 */
export interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  category: string;
  category_display: string;
  logo_url: string | null;
  description?: string;
  required_fields: string[];
  optional_fields: string[];
  fee_percentage: string;
  fee_fixed: string;
  min_withdrawal: string;
  max_withdrawal: string | null;
  daily_limit?: string | null;
  estimated_processing_hours: number | null;
}

export interface WithdrawalMethod {
  id: string;
  payment_method: PaymentMethodLite;
  /** pending (awaiting staff approval) · active · inactive (suspended / rejected) */
  status: "pending" | "active" | "inactive" | (string & {});
  label: string;
  is_default: boolean;
  account_details: Record<string, string>;
  is_verified: boolean;
  verified_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface PaymentMethodLite {
  id: string;
  name: string;
  code: string;
  category: string;
  category_display: string;
  logo_url: string | null;
  fee_percentage: string;
  fee_fixed: string;
  min_withdrawal: string;
  max_withdrawal: string | null;
  estimated_processing_hours: number | null;
}

/** One wallet journal line (§4.3). `entry_type` is from the wallet's point of view. */
export interface LedgerTransaction {
  id: string;
  /** escrow_fund · escrow_release · escrow_settle · escrow_refund · payout_reserve · payout_settle … */
  type: string;
  /** e.g. posted */
  status: string;
  entry_type: "credit" | "debit";
  amount: string;
  balance_after: string | null;
  description: string;
  /** Usually the order uuid. */
  reference: string | null;
  created_at: string;
}

/** requested · reserved · approved · paid · rejected · cancelled */
export type WithdrawalStatus = "requested" | "reserved" | "approved" | "paid" | "rejected" | "cancelled" | (string & {});

export interface Withdrawal {
  id: string;
  amount: string;
  fee_amount: string;
  net_amount: string;

  currency: Currency;

  status: WithdrawalStatus;

  method: {
    id: string;
    payment_method_name: string;
    payment_method_code: string;
    category: string;
    category_display: string;
    label: string;
  };

  external_reference: string | null;
  rejection_reason: string | null;
  user_notes: string;
  admin_notes: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

//     API object                                                                

export const walletApi = {
  /** GET /wallet/ — full wallet details */
  get: async () => normalizeWallet(await api.get<WalletDetail>("/wallet/")),

  /** GET /wallet/balance/ — lightweight balance only */
  balance: () => api.get<WalletBalance>("/wallet/balance/"),

  /** GET /wallet/transactions/ — paginated transaction history (newest first) */
  transactions: async (params?: {
    page?: number;
    page_size?: number;
    start_date?: string;
    end_date?: string;
    transaction_type?: string;
    status?: string;
  }): Promise<Paged<LedgerTransaction>> => {
    const r = await api.get<Paged<RawTransaction>>("/wallet/transactions/", { params });
    return { ...r, results: (r.results ?? []).map(normalizeTransaction) };
  },

  /** GET /wallet/payment-methods/ — payout methods the platform supports (admin-managed) */
  paymentMethods: () => api.get<PaymentMethod[]>("/wallet/payment-methods/"),

  /** GET /wallet/methods/ — my registered withdrawal methods (account details masked) */
  myMethods: () => api.get<WithdrawalMethod[]>("/wallet/methods/"),

  /** POST /wallet/methods/ — register a new withdrawal method (full account details sent once) */
  addMethod: (payload: {
    payment_method_code: string;
    label: string;
    account_details: Record<string, string>;
    is_default?: boolean;
  }) => api.post<WithdrawalMethod>("/wallet/methods/", { body: payload }),

  /** PATCH /wallet/methods/{id}/ — update label / default / account details */
  updateMethod: (
    id: string,
    payload: { label?: string; account_details?: Record<string, string>; is_default?: boolean; status?: string },
  ) => api.patch<WithdrawalMethod>(`/wallet/methods/${id}/`, { body: payload }),

  /** DELETE /wallet/methods/{id}/ */
  deleteMethod: (id: string) => api.delete<{ deleted: boolean } | null>(`/wallet/methods/${id}/`),

  /** GET /wallet/withdrawals/ — withdrawal history */
  withdrawals: (params?: { page?: number; page_size?: number; status?: string }) =>
    api.get<Paged<Withdrawal>>("/wallet/withdrawals/", { params }),

  /** POST /wallet/withdrawals/request/ — request a new withdrawal */
  requestWithdrawal: (payload: { method_id: string; amount: string; notes?: string; idempotency_key?: string }) =>
    api.post<Withdrawal>("/wallet/withdrawals/request/", { body: payload }),

  /** GET /wallet/withdrawals/{id}/ */
  withdrawalDetail: (id: string) => api.get<Withdrawal>(`/wallet/withdrawals/${id}/`),

  /** POST /wallet/withdrawals/{id}/cancel/ — requested / reserved / approved only; 409 invalid_transition otherwise */
  cancelWithdrawal: (id: string) => api.post<Withdrawal>(`/wallet/withdrawals/${id}/cancel/`, { body: {} }),
};


//     Transactions: tolerate the old and the new row shape ─────────────────────

interface RawTransaction {
  id: string;
  type?: string;
  transaction_type?: string;
  status: string;
  entry_type?: "credit" | "debit";
  entry?: { type: "credit" | "debit"; amount: string };
  amount?: string;
  total_amount?: string;
  balance_after?: string | null;
  description: string;
  reference?: string | null;
  reference_id?: string;
  created_at: string;
}

export function normalizeTransaction(t: RawTransaction): LedgerTransaction {
  return {
    id: t.id,
    type: t.type ?? t.transaction_type ?? "",
    status: t.status,
    entry_type: t.entry_type ?? t.entry?.type ?? "debit",
    amount: t.amount ?? t.entry?.amount ?? t.total_amount ?? "0.00",
    balance_after: t.balance_after ?? null,
    description: t.description,
    reference: t.reference ?? t.reference_id ?? null,
    created_at: t.created_at,
  };
}

/** `wallet.recent_transactions` rows go through the same mapper. */
export const normalizeWallet = (w: WalletDetail): WalletDetail => ({
  ...w,
  recent_transactions: ((w.recent_transactions ?? []) as unknown as RawTransaction[]).map(normalizeTransaction),
});

//     Withdrawal rules ────────────────────────────────────────────────────────

/** Error codes of POST /wallet/withdrawals/request/ (and cancel). */
export const WITHDRAWAL_ERROR_MESSAGE: Record<string, string> = {
  method_not_verified: "This payout method hasn't been approved yet.",
  below_minimum_withdrawal: "That amount is below the minimum withdrawal.",
  above_maximum_withdrawal: "That amount is above the maximum withdrawal.",
  above_daily_limit: "This would exceed today's withdrawal limit.",
  insufficient_balance: "That is more than your available balance.",
  invalid_transition: "This withdrawal can no longer be cancelled.",
};

/** Cancellable while still in flight. */
export const CANCELLABLE_WITHDRAWAL: WithdrawalStatus[] = ["requested", "reserved", "approved"];

/** Server message first (it names the actual limits), then a friendly fallback keyed by `code`. */
export function withdrawalErrorMessage(e: unknown, fallback: string): string {
  const err = e as { message?: string; code?: string } | null;
  const base = err?.code ? WITHDRAWAL_ERROR_MESSAGE[err.code] : undefined;
  return err?.message && !/^HTTP \d+$/.test(err.message) ? err.message : base ?? fallback;
}
