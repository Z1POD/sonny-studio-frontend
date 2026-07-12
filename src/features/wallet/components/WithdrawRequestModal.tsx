// src/features/wallet/components/WithdrawRequestModal.tsx

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote, Check, Loader2, Star } from "lucide-react";
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