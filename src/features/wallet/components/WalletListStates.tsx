// src/features/wallet/components/WalletListStates.tsx
//
// Small shared presentational states used by the transactions/withdrawals
// lists: empty state, error state, and a loading skeleton.

"use client";

import { AlertTriangle, Clock } from "lucide-react";

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-overlay text-muted-foreground">
        <Clock className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-red-400">{message}</p>
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-overlay" />
      ))}
    </div>
  );
}