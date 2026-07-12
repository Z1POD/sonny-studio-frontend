// src/features/wallet/components/WithdrawalRow.tsx

"use client";

import { Banknote, Ban } from "lucide-react";
import type { Withdrawal } from "../api";
import { formatMoney, withdrawalStatusColor } from "../lib/wallet-format";

export function WithdrawalRow({
  w,
  onCancel,
}: {
  w: Withdrawal;
  onCancel: (id: string) => void;
}) {
  const symbol = w.currency.symbol;
  const canCancel = w.status === "pending";

  return (
    <li className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${withdrawalStatusColor(w.status)}`}>
          <Banknote className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            Withdrawal via {w.method.payment_method_name}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {new Date(w.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {w.user_notes && ` · "${w.user_notes}"`}
          </div>
          {w.rejection_reason && (
            <div className="mt-0.5 text-[11px] text-red-400">{w.rejection_reason}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums">{formatMoney(w.amount, symbol)}</div>
          {parseFloat(w.fee_amount) > 0 && (
            <div className="text-[11px] text-muted-foreground">Fee {formatMoney(w.fee_amount, symbol)}</div>
          )}
        </div>
        {canCancel && (
          <button
            onClick={() => onCancel(w.id)}
            title="Cancel withdrawal"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition hover:border-red-500/60 hover:text-red-500"
          >
            <Ban className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}