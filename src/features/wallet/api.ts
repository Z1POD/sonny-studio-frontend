/**
 * src/features/wallet/api.ts
 *
 * Wallet API — fully aligned to backend contract.
 */

import { api } from "@/shared/api/client";

// ─── Shared shapes ────────────────────────────────────────────────────────────

export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

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

export interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  category: string;
  category_display: string;
  logo_url: string | null;
  description: string;
  required_fields: string[];
  optional_fields: string[];
  fee_percentage: string;
  fee_fixed: string;
  min_withdrawal: string;
  max_withdrawal: string;
  daily_limit: string | null;
  estimated_processing_hours: number;
  is_active: boolean;
  sort_order: number;
}

export interface WithdrawalMethod {
  id: string;
  payment_method: PaymentMethodLite;
  status: string;
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
  max_withdrawal: string;
  estimated_processing_hours: number;
}

export interface LedgerEntry {
  id: string;
  account_name: string;
  account_code: string;
  entry_type: "credit" | "debit";
  amount: string;
  balance_after: string;
  description: string;
  created_at: string;
}

export interface LedgerTransaction {
  id: string;
  transaction_type: string;
  status: string;
  total_amount: string;
  currency: { code: string; symbol: string };
  description: string;
  reference_type: string;
  reference_id: string;
  entries: LedgerEntry[];
  is_reconciled: boolean;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  amount: string;
  fee_amount: string;
  net_amount: string;

  currency: {
    code: string;
    symbol: string;
  };

  status: string;

  method: {
    id: string;
    payment_method_name: string;
    payment_method_code: string;
    category: string;
    category_display: string;
    label: string;
  };

  external_reference: string;
  rejection_reason: string;
  user_notes: string;
  admin_notes: string;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WithdrawalListResponse {
  results: Withdrawal[];
  pagination: Pagination;
}

export interface Pagination {
  count: number;
  next: string | null;
  previous: string | null;
}

// ─── API object ───────────────────────────────────────────────────────────────

export const walletApi = {
  /** GET /wallet/ — full wallet details */
  get: () =>
    api.get<{ success: boolean; data: WalletDetail }>("/wallet/"),

  /** GET /wallet/balance/ — lightweight balance only */
  balance: () =>
    api.get<{ success: boolean; data: WalletBalance }>("/wallet/balance/"),

  /** GET /wallet/transactions/ — paginated transaction history */
  transactions: (params?: {
    page?: number;
    page_size?: number;
    start_date?: string;
    end_date?: string;
    transaction_type?: string;
    status?: string;
  }) =>
    api.get<{ success: boolean; data: LedgerTransaction[]; pagination: Pagination }>(
      "/wallet/transactions/",
      { params },
    ),

  /** GET /wallet/payment-methods/ — available payment methods (admin-managed) */
  paymentMethods: () =>
    api.get<{ success: boolean; data: PaymentMethod[] }>("/wallet/payment-methods/"),

  /** GET /wallet/methods/ — my registered withdrawal methods */
  myMethods: () =>
    api.get<{ success: boolean; data: WithdrawalMethod[] }>("/wallet/methods/"),

  /** POST /wallet/methods/ — register a new withdrawal method */
  addMethod: (payload: {
    payment_method_code: string;
    label: string;
    account_details: Record<string, string>;
    is_default?: boolean;
  }) =>
    api.post<{ success: boolean; data: WithdrawalMethod }>("/wallet/methods/", {
      body: payload,
    }),

  /** PUT /wallet/methods/{id}/ — update a withdrawal method */
  updateMethod: (
    id: string,
    payload: {
      label?: string;
      account_details?: Record<string, string>;
      is_default?: boolean;
      status?: string;
    },
  ) =>
    api.put<{ success: boolean; data: WithdrawalMethod }>(`/wallet/methods/${id}/`, {
      body: payload,
    }),

  /** DELETE /wallet/methods/{id}/ — delete a withdrawal method */
  deleteMethod: (id: string) => api.delete(`/wallet/methods/${id}/`),

  /** GET /wallet/withdrawals/ — withdrawal history */
  withdrawals: (params?: {page?: number; page_size?: number; status?: string;

  }) =>
    api.get<WithdrawalListResponse>("/wallet/withdrawals/",
      { params }
  ),

  /** POST /wallet/withdrawals/request/ — request a new withdrawal */
  requestWithdrawal: (payload: {
    method_id: string;
    amount: string;
    notes?: string;
  }) =>
    api.post<{ success: boolean; data: Withdrawal }>("/wallet/withdrawals/request/", {
      body: payload,
    }),

  /** GET /wallet/withdrawals/{id}/ — withdrawal detail */
  withdrawalDetail: (id: string) =>
    api.get<{ success: boolean; data: Withdrawal }>(`/wallet/withdrawals/${id}/`),

  /** DELETE /wallet/withdrawals/{id}/ — cancel pending withdrawal */
  cancelWithdrawal: (id: string) =>
    api.delete<{ success: boolean; data: Withdrawal }>(`/wallet/withdrawals/${id}/`),
};
