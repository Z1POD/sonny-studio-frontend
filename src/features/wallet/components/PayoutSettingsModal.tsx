// src/features/wallet/components/PayoutSettingsModal.tsx

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Trash2 } from "lucide-react";
import { appToast as toast } from "@/lib/toaster";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { myWithdrawalMethodsQuery, walletKeys } from "../queries";
import { walletApi } from "../api";
import { categoryIcon } from "../lib/wallet-format";
import { useConfirm } from "@/shared/components/ConfirmModal";

export function PayoutSettingsModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [confirm, ConfirmModal] = useConfirm();
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

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Remove this withdrawal method?",
      description: "You can add it again later, but any pending payouts tied to it may need to be re-verified.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (ok) deleteMutation.mutate(id);
  };

  return (
    <>
      <div className="space-y-5 max-h-[70dvh] overflow-y-auto pr-1 no-scrollbar">
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
                      onClick={() => handleDelete(m.id)}
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

      {ConfirmModal}
    </>
  );
}