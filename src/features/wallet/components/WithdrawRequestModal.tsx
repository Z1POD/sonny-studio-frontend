// src/features/wallet/components/WithdrawRequestModal.tsx

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Banknote, Check, ChevronsUpDown, Loader2, Star } from "lucide-react";
import { appToast as toast } from "@/lib/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { myWithdrawalMethodsQuery, walletKeys } from "../queries";
import { walletApi } from "../api";
import { formatMoney, categoryIcon } from "../lib/wallet-format";

export function WithdrawRequestModal({
  onClose,
  walletData,
}: {
  onClose: () => void;
  walletData: { balance: { available: string }; currency: { symbol: string } } | null;
}) {
  const qc = useQueryClient();
  const { data: methodsData } = useQuery(myWithdrawalMethodsQuery());
  const methods = methodsData?.data ?? [];

  const [selectedMethodId, setSelectedMethodId] = useState<string>("");
  const [methodsExpanded, setMethodsExpanded] = useState(false);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const available = parseFloat(walletData?.balance?.available ?? "0");
  const symbol = walletData?.currency?.symbol ?? "$";
  const selectedMethod = methods.find((m) => m.id === selectedMethodId);
  const minW = selectedMethod ? parseFloat(selectedMethod.payment_method.min_withdrawal) : 0;
  const maxW = selectedMethod ? parseFloat(selectedMethod.payment_method.max_withdrawal) : Infinity;
  const val = parseFloat(amount) || 0;

  const amountValid = val > 0 && val >= minW && val <= maxW && val <= available;
  const methodSelected = !!selectedMethod;
  const methodVerified = !!selectedMethod?.is_verified;
  const valid = amountValid && methodSelected && methodVerified;

  const selectMethod = (id: string) => {
    setSelectedMethodId(id);
    setMethodsExpanded(false);
  };

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
        {amount !== "" && !amountValid && (
          <p className="text-xs text-amber-400">
            {val > available
              ? "Amount exceeds your available balance."
              : selectedMethod && val < minW
              ? `Amount is below the minimum of ${formatMoney(minW, symbol)} for this method.`
              : selectedMethod && val > maxW
              ? `Amount is above the maximum of ${formatMoney(maxW, symbol)} for this method.`
              : "Enter a valid amount."}
          </p>
        )}
      </div>

      {/* Method selection */}
      <div className="space-y-2">
        <Label>Withdrawal method</Label>
        {methods.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/60 p-4 text-center text-sm text-muted-foreground">
            No withdrawal methods. Add one in Payout Settings.
          </div>
        ) : selectedMethod && !methodsExpanded ? (
          <button
            type="button"
            onClick={() => setMethodsExpanded(true)}
            className="flex w-full items-center gap-3 rounded-xl border border-primary bg-primary/5 px-3 py-2.5 text-left transition hover:border-primary/70"
          >
            {selectedMethod.payment_method.logo_url ? (
              <img
                src={selectedMethod.payment_method.logo_url}
                alt=""
                className="h-8 w-8 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-overlay text-muted-foreground">
                {categoryIcon(selectedMethod.payment_method.category)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{selectedMethod.label}</span>
                {selectedMethod.is_default && <Star className="h-3.5 w-3.5 text-amber-400" />}
                {selectedMethod.is_verified ? (
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
                {selectedMethod.payment_method.name} · Fee {selectedMethod.payment_method.fee_percentage}% +{" "}
                {formatMoney(selectedMethod.payment_method.fee_fixed, symbol)}
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary">
              <ChevronsUpDown className="h-3 w-3" /> Change
            </span>
          </button>
        ) : (
          <div className="space-y-2 mt-1">
            {methods.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMethod(m.id)}
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
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{m.label}</span>
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
                    {m.payment_method.name} · Fee {m.payment_method.fee_percentage}% + {formatMoney(m.payment_method.fee_fixed, symbol)}
                  </div>
                </div>
                {m.is_default && <Star className="h-3.5 w-3.5 text-amber-400" />}
                {selectedMethodId === m.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        )}

        {methods.length > 0 && !selectedMethod && (
          <p className="text-xs text-amber-400">Select a withdrawal method to continue.</p>
        )}

        {selectedMethod && !selectedMethod.is_verified && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              This method is still being verified. Please wait until verification completes before
              withdrawing, or contact support if this is taking longer than expected.
            </span>
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
          disabled={!valid || mutation.isPending || methods.length === 0}
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