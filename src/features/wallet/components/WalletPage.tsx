// src/features/wallet/components/WalletPage.tsx

"use client";

import { useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Banknote, ChevronDown, Clock, Loader2, Wallet as WalletIcon, Plus, Settings } from "lucide-react";
import { appToast as toast } from "@/lib/toaster";
import { Button } from "@/components/ui/button";
import {
  walletDetailQuery,
  walletBalanceQuery,
  walletTransactionsInfiniteQuery,
  walletKeys,
  withdrawalsInfiniteQuery,
} from "../queries";
import { walletApi } from "../api";
import { formatMoney } from "../lib/wallet-format";
import { WalletSheet } from "./WalletSheet";
import { WithdrawRequestModal } from "./WithdrawRequestModal";
import { AddMethodModal } from "./AddMethodModal";
import { PayoutSettingsModal } from "./PayoutSettingsModal";
import { TransactionRow } from "./TransactionRow";
import { WithdrawalRow } from "./WithdrawalRow";
import { EmptyState, ErrorState, ListSkeleton } from "./WalletListStates";

export function WalletPage() {
  const qc = useQueryClient();
  const { data: walletRes, isLoading: walletLoading } = useQuery(walletDetailQuery());
  const { data: balanceRes } = useQuery(walletBalanceQuery());

  // Transactions — infinite query (paginated "Load more")
  const {
    data: txData,
    isLoading: txLoading,
    isError: txIsError,
    error: txError,
    fetchNextPage: fetchNextTxPage,
    hasNextPage: hasNextTxPage,
    isFetchingNextPage: isFetchingNextTxPage,
  } = useInfiniteQuery(walletTransactionsInfiniteQuery(20));

  // Withdrawals — infinite query (paginated "Load more")
  const {
    data: wdData,
    isLoading: wdLoading,
    isError: wdIsError,
    error: wdError,
    fetchNextPage: fetchNextWdPage,
    hasNextPage: hasNextWdPage,
    isFetchingNextPage: isFetchingNextWdPage,
  } = useInfiniteQuery(withdrawalsInfiniteQuery(20));

  const wallet = walletRes?.data;
  const balance = balanceRes?.data;

  // Fallback to wallet detail's recent_transactions only if the paginated
  // query genuinely came back empty (not just still loading).
  const transactions = useMemo(() => {
    const fromPages = txData?.pages.flatMap((p) => p.data) ?? [];
    if (fromPages.length > 0) return fromPages;
    if (!txLoading && wallet?.recent_transactions && wallet.recent_transactions.length > 0) {
      return wallet.recent_transactions;
    }
    return fromPages;
  }, [txData, txLoading, wallet]);

  const withdrawals = wdData?.pages.flatMap((p) => p.results) ?? [];

  const [activeTab, setActiveTab] = useState<"transactions" | "withdrawals">("transactions");
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const cancelMutation = useMutation({
    mutationFn: (id: string) => walletApi.cancelWithdrawal(id),
    onSuccess: () => {
      toast.success("Withdrawal cancelled");
      qc.invalidateQueries({ queryKey: walletKeys.all });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to cancel"),
  });

  const handleCancelWithdrawal = (id: string) => {
    if (confirm("Cancel this withdrawal? Funds will be returned to your wallet.")) {
      cancelMutation.mutate(id);
    }
  };

  const symbol = wallet?.currency?.symbol ?? balance?.currency?.symbol ?? "$";
  const available = parseFloat(wallet?.balance?.available ?? balance?.available ?? "0");
  const pending = parseFloat(wallet?.balance?.pending ?? balance?.pending ?? "0");
  const totalEarned = parseFloat(wallet?.total_earned ?? "0");
  const totalWithdrawn = parseFloat(wallet?.total_withdrawn ?? "0");

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-24 pt-6 sm:px-8">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Wallet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Earnings, transactions and withdrawals.
        </p>
      </motion.header>

      {/* Balance cards */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface-elevated via-surface to-surface p-6 sm:col-span-2"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl" aria-hidden />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <WalletIcon className="h-3.5 w-3.5" /> Available balance
            </div>
            <div className="mt-3 text-4xl font-semibold tracking-tight">
              {walletLoading ? "—" : formatMoney(available, symbol)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Pending {formatMoney(pending, symbol)} · {wallet?.currency?.code ?? "USD"}
            </div>
            <div className="mt-5 flex gap-2">
              <Button onClick={() => setShowWithdraw(true)} className="rounded-full">
                <Banknote className="mr-2 h-4 w-4" /> Withdraw
              </Button>
              <Button variant="secondary" className="rounded-full" onClick={() => setShowSettings(true)}>
                <Settings className="mr-2 h-4 w-4" /> Payout settings
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="rounded-3xl border border-border bg-surface p-6"
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Pending
          </div>
          <div className="mt-3 text-2xl font-semibold tracking-tight">
            {formatMoney(pending, symbol)}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Clears 7 days after delivery confirmation.
          </p>
        </motion.div>
      </section>

      {/* Stats row */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Earned</div>
          <div className="mt-1 text-lg font-semibold">{formatMoney(totalEarned, symbol)}</div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Withdrawn</div>
          <div className="mt-1 text-lg font-semibold">{formatMoney(totalWithdrawn, symbol)}</div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Methods</div>
          <div className="mt-1 text-lg font-semibold">{wallet?.withdrawal_methods?.length ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</div>
          <div className="mt-1 text-lg font-semibold capitalize">{wallet?.status ?? "—"}</div>
        </div>
      </section>

      {/* Tabs + list */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex gap-0">
            {(["transactions", "withdrawals"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={
                  "px-4 py-2 text-xs font-medium capitalize transition border-b-2 " +
                  (activeTab === tab
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground")
                }
              >
                {tab}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-xs"
            onClick={() => setShowAddMethod(true)}
          >
            <Plus className="mr-1.5 h-3 w-3" /> Add method
          </Button>
        </div>

        <div className="overflow-hidden rounded-3xl border border-border bg-surface">
          {activeTab === "transactions" ? (
            txLoading ? (
              <ListSkeleton />
            ) : txIsError ? (
              <ErrorState message={txError?.message ?? "Failed to load transactions"} />
            ) : transactions.length === 0 ? (
              <EmptyState message="No transactions yet." />
            ) : (
              <ul className="divide-y divide-border">
                {transactions.map((t) => (
                  <TransactionRow key={t.id} t={t} />
                ))}
              </ul>
            )
          ) : wdLoading ? (
            <ListSkeleton />
          ) : wdIsError ? (
            <ErrorState message={wdError?.message ?? "Failed to load withdrawals"} />
          ) : withdrawals.length === 0 ? (
            <EmptyState message="No withdrawals yet." />
          ) : (
            <ul className="divide-y divide-border">
              {withdrawals.map((w) => (
                <WithdrawalRow key={w.id} w={w} onCancel={handleCancelWithdrawal} />
              ))}
            </ul>
          )}
        </div>

        {/* Load more */}
        {activeTab === "transactions" && hasNextTxPage && (
          <div className="flex justify-center pt-3">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              onClick={() => fetchNextTxPage()}
              disabled={isFetchingNextTxPage}
            >
              {isFetchingNextTxPage ? (
                <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Loading…</>
              ) : (
                <><ChevronDown className="mr-2 h-3 w-3" /> Load more</>
              )}
            </Button>
          </div>
        )}
        {activeTab === "withdrawals" && hasNextWdPage && (
          <div className="flex justify-center pt-3">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              onClick={() => fetchNextWdPage()}
              disabled={isFetchingNextWdPage}
            >
              {isFetchingNextWdPage ? (
                <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Loading…</>
              ) : (
                <><ChevronDown className="mr-2 h-3 w-3" /> Load more</>
              )}
            </Button>
          </div>
        )}
      </section>

      {/* Modals */}
      <WalletSheet
        open={showWithdraw}
        onOpenChange={setShowWithdraw}
        title="Withdraw funds"
        description="Move available balance to your linked destination."
      >
        <WithdrawRequestModal
          onClose={() => setShowWithdraw(false)}
          walletData={wallet ? { balance: wallet.balance, currency: wallet.currency } : null}
        />
      </WalletSheet>

      <WalletSheet
        open={showAddMethod}
        onOpenChange={setShowAddMethod}
        title="Add withdrawal method"
        description="Register a new payout destination."
      >
        <AddMethodModal onClose={() => setShowAddMethod(false)} />
      </WalletSheet>

      <WalletSheet
        open={showSettings}
        onOpenChange={setShowSettings}
        title="Payout settings"
        description="Manage your withdrawal methods."
      >
        <PayoutSettingsModal onClose={() => setShowSettings(false)} />
      </WalletSheet>
    </div>
  );
}