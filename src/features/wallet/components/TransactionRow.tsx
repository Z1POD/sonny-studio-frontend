// src/features/wallet/components/TransactionRow.tsx

"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { LedgerTransaction } from "../api";
import { formatMoney, txTypeLabel, txStatusColor } from "../lib/wallet-format";

export function TransactionRow({ t, currency }: { t: LedgerTransaction; currency: string | { symbol?: string; code?: string; decimal_places?: number } }) {
  const isCredit = t.entry_type === "credit";
  const amount = parseFloat(t.amount);
  const symbol = currency;

  return (
    <li className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={
            "inline-flex h-9 w-9 items-center justify-center rounded-full " +
            (isCredit ? "bg-emerald-500/10 text-emerald-400" : "bg-surface-overlay text-muted-foreground")
          }
        >
          {isCredit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{t.description}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {new Date(t.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}{" "}
            · <span className="capitalize">{txTypeLabel(t.type)}</span>
            {" · "}
            <span className={txStatusColor(t.status)}>{t.status}</span>
          </div>
        </div>
      </div>
      <div
        className={
          "text-sm font-semibold tabular-nums " +
          (isCredit ? "text-emerald-400" : "text-foreground")
        }
      >
        {isCredit ? "+" : "-"}
        {formatMoney(amount, symbol)}
      </div>
    </li>
  );
}