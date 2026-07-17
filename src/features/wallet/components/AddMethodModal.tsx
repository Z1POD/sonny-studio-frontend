// src/features/wallet/components/AddMethodModal.tsx

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { appToast as toast } from "@/lib/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { paymentMethodsQuery, walletKeys } from "../queries";
import { walletApi } from "../api";
import { formatMoney, categoryIcon } from "../lib/wallet-format";

export function AddMethodModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: pmData } = useQuery(paymentMethodsQuery());
  const paymentMethods = pmData?.data ?? [];

  const [selectedPmId, setSelectedPmId] = useState<string>("");
  const [pmExpanded, setPmExpanded] = useState(false);
  const [label, setLabel] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [details, setDetails] = useState<Record<string, string>>({});

  const selectedPm = paymentMethods.find((p) => p.id === selectedPmId);

  const selectPm = (id: string) => {
    setSelectedPmId(id);
    setDetails({});
    setPmExpanded(false);
  };

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
    <div className="space-y-5 max-h-[70dvh] overflow-y-auto pr-1 no-scrollbar">
      {/* Payment method selection */}
      <div className="space-y-2">
        <Label>Payment method</Label>
        {selectedPm && !pmExpanded ? (
          <button
            type="button"
            onClick={() => setPmExpanded(true)}
            className="flex w-full items-center gap-3 rounded-xl border border-primary bg-primary/5 px-3 py-2.5 text-left transition hover:border-primary/70"
          >
            {selectedPm.logo_url ? (
              <img src={selectedPm.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-overlay text-muted-foreground">
                {categoryIcon(selectedPm.category)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{selectedPm.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {selectedPm.category_display} · Min {formatMoney(selectedPm.min_withdrawal)} ·{" "}
                {selectedPm.estimated_processing_hours}h
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary">
              <ChevronsUpDown className="h-3 w-3" /> Change
            </span>
          </button>
        ) : (
          <div className="space-y-2">
            {paymentMethods.map((pm) => (
              <button
                key={pm.id}
                type="button"
                onClick={() => selectPm(pm.id)}
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
        )}
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