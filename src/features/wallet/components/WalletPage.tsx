// src/features/wallet/components/WalletPage.tsx

"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Clock,
  Wallet as WalletIcon,
  Plus,
  Trash2,
  Star,
  Check,
  ChevronDown,
  Loader2,
  X,
  AlertTriangle,
  CreditCard,
  Smartphone,
  Globe,
  Bitcoin,
  Settings,
  Ban,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  walletDetailQuery,
  walletBalanceQuery,
  walletTransactionsQuery,
  walletKeys,
  paymentMethodsQuery,
  myWithdrawalMethodsQuery,
  withdrawalsQuery,
} from "../queries";
import { walletApi, type WithdrawalMethod, type PaymentMethod, type LedgerTransaction, type Withdrawal } from "../api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(amount: string | number, symbol = "$"): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return `${symbol} ${n.toFixed(2)}`;
}

function txTypeLabel(type: string): string {
  const map: Record<string, string> = {
    order_payment: "Order Payment",
    order_refund: "Order Refund",
    creator_earning: "Earning",
    creator_payout: "Payout",
    platform_fee: "Platform Fee",
    apparel_cost: "Product Cost",
    print_cost: "Print Cost",
    adjustment: "Adjustment",
    bonus: "Bonus",
    chargeback: "Chargeback",
  };
  return map[type] ?? type.replace(/_/g, " ");
}

function txStatusColor(status: string): string {
  switch (status) {
    case "completed": return "text-emerald-400";
    case "pending": return "text-amber-400";
    case "failed": return "text-red-400";
    case "reversed": return "text-muted-foreground";
    default: return "text-muted-foreground";
  }
}

function withdrawalStatusColor(status: string): string {
  switch (status) {
    case "completed": return "bg-emerald-500/10 text-emerald-400";
    case "pending": return "bg-amber-500/10 text-amber-400";
    case "approved": return "bg-blue-500/10 text-blue-400";
    case "processing": return "bg-purple-500/10 text-purple-400";
    case "rejected": return "bg-red-500/10 text-red-400";
    case "failed": return "bg-red-500/10 text-red-400";
    case "cancelled": return "bg-border/40 text-muted-foreground";
    default: return "bg-border/40 text-muted-foreground";
  }
}

function categoryIcon(category: string) {
  switch (category) {
    case "bank_transfer": return <CreditCard className="h-4 w-4" />;
    case "mobile_money": return <Smartphone className="h-4 w-4" />;
    case "digital_wallet": return <Globe className="h-4 w-4" />;
    case "crypto": return <Bitcoin className="h-4 w-4" />;
    default: return <CreditCard className="h-4 w-4" />;
  }
}

// ─── Withdrawal Request Modal ────────────────────────────────────────────────

function WithdrawRequestModal({
  onClose,
  walletData,
}: {
  onClose: () => void;
  walletData: { balance: { available: string }; currency: { symbol: string } } | null;
}) {
  const qc = useQueryClient();
  const { data: methodsData } = useQuery(myWithdrawalMethodsQuery());
  const methods = methodsData?.data ?? [];
  const verifiedMethods = methods.filter((m) => m.status === "verified" || m.status === "active");

  const [selectedMethodId, setSelectedMethodId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const available = parseFloat(walletData?.balance?.available ?? "0");
  const symbol = walletData?.currency?.symbol ?? "$";
  const selectedMethod = methods.find((m) => m.id === selectedMethodId);
  const minW = selectedMethod ? parseFloat(selectedMethod.payment_method.min_withdrawal) : 0;
  const maxW = selectedMethod ? parseFloat(selectedMethod.payment_method.max_withdrawal) : Infinity;
  const val = parseFloat(amount) || 0;
  const valid = val > 0 && val <= available && val >= minW && val <= maxW;

  const mutation = useMutation({
    mutationFn: () =>
      walletApi.requestWithdrawal({
        method_id: selectedMethodId,
        amount: val.toFixed(2),
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success("Withdrawal requested successfully");
      qc.invalidateQueries({ queryKey: walletKeys.all });
      onClose();
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Failed to request withdrawal");
    },
  });

  return (
    <div className="space-y-5">
      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="w-amount">Amount ({symbol})</Label>
        <Input
          id="w-amount"
          type="number"
          min={minW || 0}
          max={Math.min(available, maxW)}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="rounded-xl bg-surface text-lg"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Available: {formatMoney(available, symbol)}</span>
          {selectedMethod && (
            <span>
              Min {formatMoney(minW, symbol)} · Max {formatMoney(maxW, symbol)}
            </span>
          )}
        </div>
      </div>

      {/* Method selection */}
      <div className="space-y-2">
        <Label>Withdrawal method</Label>
        {verifiedMethods.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/60 p-4 text-center text-sm text-muted-foreground">
            No verified withdrawal methods. Add one in Payout Settings.
          </div>
        ) : (
          <div className="space-y-2 mt-3">
            {verifiedMethods.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMethodId(m.id)}
                className={
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition " +
                  (selectedMethodId === m.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-surface hover:border-primary/40")
                }
              >
                {m.payment_method.logo_url ? (
                  <img src={m.payment_method.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-overlay text-muted-foreground">
                    {categoryIcon(m.payment_method.category)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{m.label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {m.payment_method.name} · Fee {m.payment_method.fee_percentage}% + {formatMoney(m.payment_method.fee_fixed, symbol)}
                  </div>
                </div>
                {m.is_default && <Star className="h-3.5 w-3.5 text-amber-400" />}
                {selectedMethodId === m.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="w-notes">Notes (optional)</Label>
        <Input
          id="w-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Monthly withdrawal..."
          className="rounded-xl bg-surface"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => mutation.mutate()}
          disabled={!valid || mutation.isPending || verifiedMethods.length === 0}
          className="rounded-full"
        >
          {mutation.isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Requesting…</>
          ) : (
            <><Banknote className="mr-2 h-4 w-4" /> Request withdrawal</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Add Method Modal ────────────────────────────────────────────────────────

function AddMethodModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: pmData } = useQuery(paymentMethodsQuery());
  const paymentMethods = pmData?.data ?? [];

  const [selectedPmId, setSelectedPmId] = useState<string>("");
  const [label, setLabel] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [details, setDetails] = useState<Record<string, string>>({});

  const selectedPm = paymentMethods.find((p) => p.id === selectedPmId);

  const mutation = useMutation({
    mutationFn: () =>
      walletApi.addMethod({
        payment_method_code: selectedPm!.code,
        label: label || selectedPm!.name,
        account_details: details,
        is_default: isDefault,
      }),
    onSuccess: () => {
      toast.success("Withdrawal method added");
      qc.invalidateQueries({ queryKey: walletKeys.myMethods() });
      onClose();
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Failed to add method");
    },
  });

  const allRequiredFilled = selectedPm?.required_fields.every((f) => details[f]?.trim()) ?? false;

  return (
    <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1 no-scrollbar">
      {/* Payment method selection */}
      <div className="space-y-2">
        <Label>Payment method</Label>
        <div className="space-y-2">
          {paymentMethods.map((pm) => (
            <button
              key={pm.id}
              type="button"
              onClick={() => {
                setSelectedPmId(pm.id);
                setDetails({});
              }}
              className={
                "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition " +
                (selectedPmId === pm.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-surface hover:border-primary/40")
              }
            >
              {pm.logo_url ? (
                <img src={pm.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-overlay text-muted-foreground">
                  {categoryIcon(pm.category)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{pm.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {pm.category_display} · Min {formatMoney(pm.min_withdrawal)} · {pm.estimated_processing_hours}h
                </div>
              </div>
              {selectedPmId === pm.id && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      </div>

      {selectedPm && (
        <>
          <div className="space-y-2">
            <Label htmlFor="m-label">Label</Label>
            <Input
              id="m-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={`My ${selectedPm.name}`}
              className="rounded-xl bg-surface"
            />
          </div>

          <div className="space-y-3">
            <Label>Account details</Label>
            {selectedPm.required_fields.map((field) => (
              <div key={field} className="space-y-1">
                <Label htmlFor={`f-${field}`} className="text-xs capitalize">
                  {field.replace(/_/g, " ")} *
                </Label>
                <Input
                  id={`f-${field}`}
                  value={details[field] ?? ""}
                  onChange={(e) => setDetails((prev) => ({ ...prev, [field]: e.target.value }))}
                  placeholder={field.replace(/_/g, " ")}
                  className="rounded-xl bg-surface"
                />
              </div>
            ))}
            {selectedPm.optional_fields.map((field) => (
              <div key={field} className="space-y-1">
                <Label htmlFor={`f-${field}`} className="text-xs capitalize text-muted-foreground">
                  {field.replace(/_/g, " ")} (optional)
                </Label>
                <Input
                  id={`f-${field}`}
                  value={details[field] ?? ""}
                  onChange={(e) => setDetails((prev) => ({ ...prev, [field]: e.target.value }))}
                  placeholder={field.replace(/_/g, " ")}
                  className="rounded-xl bg-surface"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-surface-elevated/40 p-3">
            <div>
              <p className="text-sm font-medium">Set as default</p>
              <p className="text-xs text-muted-foreground">Use this method for withdrawals</p>
            </div>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => mutation.mutate()}
          disabled={!allRequiredFilled || !selectedPm || mutation.isPending}
          className="rounded-full"
        >
          {mutation.isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding…</>
          ) : (
            <><Plus className="mr-2 h-4 w-4" /> Add method</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Payout Settings Modal ───────────────────────────────────────────────────

function PayoutSettingsModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: methodsData } = useQuery(myWithdrawalMethodsQuery());
  const methods = methodsData?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => walletApi.deleteMethod(id),
    onSuccess: () => {
      toast.success("Method removed");
      qc.invalidateQueries({ queryKey: walletKeys.myMethods() });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to remove method"),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => walletApi.updateMethod(id, { is_default: true }),
    onSuccess: () => {
      toast.success("Default method updated");
      qc.invalidateQueries({ queryKey: walletKeys.myMethods() });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update"),
  });

  return (
    <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1 no-scrollbar">
      <div className="space-y-3">
        <Label>Your withdrawal methods</Label>
        {methods.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/60 p-6 text-center text-sm text-muted-foreground">
            No withdrawal methods yet. Add one to start withdrawing.
          </div>
        ) : (
          <div className="space-y-2">
            {methods.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                {m.payment_method.logo_url ? (
                  <img src={m.payment_method.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-overlay text-muted-foreground">
                    {categoryIcon(m.payment_method.category)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{m.label}</span>
                    {m.is_default && (
                      <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                        Default
                      </span>
                    )}
                    {m.is_verified ? (
                      <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                        Verified
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                        Unverified
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {m.payment_method.name} · {Object.values(m.account_details)[0]}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!m.is_default && m.status !== "archived" && (
                    <button
                      onClick={() => setDefaultMutation.mutate(m.id)}
                      disabled={setDefaultMutation.isPending}
                      title="Set as default"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition hover:border-primary/60 hover:text-primary"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm("Remove this withdrawal method?")) {
                        deleteMutation.mutate(m.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    title="Remove"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition hover:border-red-500/60 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

// ─── Transaction Row ──────────────────────────────────────────────────────────

function TransactionRow({ t }: { t: LedgerTransaction }) {
  const isCredit = t.entry.type === "credit";
  const amount = parseFloat(t.entry.amount);
  const symbol = t.currency.symbol;

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
            · <span className="capitalize">{txTypeLabel(t.transaction_type)}</span>
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

// ─── Withdrawal Row ───────────────────────────────────────────────────────────

function WithdrawalRow({
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

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-overlay text-muted-foreground">
        <Clock className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-red-400">{message}</p>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-overlay" />
      ))}
    </div>
  );
}

// ─── WalletPage ───────────────────────────────────────────────────────────────

export function WalletPage() {
  const qc = useQueryClient();
  const { data: walletRes, isLoading: walletLoading } = useQuery(walletDetailQuery());
  const { data: balanceRes } = useQuery(walletBalanceQuery());
  
  // Transactions query with proper error handling
  const {
    data: txRes,
    isLoading: txLoading,
    isError: txIsError,
    error: txError,
  } = useQuery({
    ...walletTransactionsQuery(),
    // Use wallet detail's recent_transactions as placeholder while loading
    placeholderData: (previousData) => previousData,
  });

  // Withdrawals query with proper error handling
  const {
    data: wdRes,
    isLoading: wdLoading,
    isError: wdIsError,
    error: wdError,
  } = useQuery({
    ...withdrawalsQuery(),
    placeholderData: (previousData) => previousData,
  });

  const wallet = walletRes?.data;
  const balance = balanceRes?.data;
  
  // Fallback to wallet detail's recent_transactions if separate query fails or is empty
  const transactions = useMemo(() => {
    if (txRes?.data && txRes.data.length > 0) return txRes.data;
    if (wallet?.recent_transactions && wallet.recent_transactions.length > 0) return wallet.recent_transactions;
    return [];
  }, [txRes, wallet]);

  const withdrawals = wdRes?.results ?? [];

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
      </section>

      {/* Modals */}
      <AnimatePresence>
        {showWithdraw && (
          <ModalWrapper title="Withdraw funds" description="Move available balance to your linked destination." onClose={() => setShowWithdraw(false)}>
            <WithdrawRequestModal onClose={() => setShowWithdraw(false)} walletData={wallet ? { balance: wallet.balance, currency: wallet.currency } : null} />
          </ModalWrapper>
        )}
        {showAddMethod && (
          <ModalWrapper title="Add withdrawal method" description="Register a new payout destination." onClose={() => setShowAddMethod(false)}>
            <AddMethodModal onClose={() => setShowAddMethod(false)} />
          </ModalWrapper>
        )}
        {showSettings && (
          <ModalWrapper title="Payout settings" description="Manage your withdrawal methods." onClose={() => setShowSettings(false)}>
            <PayoutSettingsModal onClose={() => setShowSettings(false)} />
          </ModalWrapper>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Modal wrapper (bottom sheet mobile / centred desktop) ───────────────────

function ModalWrapper({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      key="wallet-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
        className="relative z-10 w-full max-h-[90dvh] overflow-hidden rounded-t-3xl border border-border/60 bg-surface shadow-2xl md:w-[650px] md:rounded-3xl md:max-h-[85vh]"
      >
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>
        <div className="flex items-start justify-between border-b border-border/40 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border/50 text-muted-foreground transition hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="px-5 py-5" style={{ maxHeight: "calc(85vh - 80px)", overflowY: "auto" }}>
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}