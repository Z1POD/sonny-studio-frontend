// Notification preferences (`GET/PATCH /notifications/preferences/`) — shared by Profile and Notifications pages.

"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { appToast as toast } from "@/lib/toaster";
import { accountApi, type NotificationPrefs } from "../api";
import { accountKeys, prefsQuery } from "../queries";

const ROWS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  { key: "telegram_enabled", label: "Telegram messages", hint: "Order and payment updates in Telegram" },
  { key: "email_enabled", label: "Email", hint: "Receive updates by email" },
  { key: "notify_order_updates", label: "Order updates", hint: "Status changes, shipping and delivery" },
  { key: "notify_payment_updates", label: "Payment updates", hint: "Verification results and receipts" },
  { key: "allow_admin_broadcast", label: "Announcements", hint: "News and offers from the marketplace" },
];

export function NotificationPrefsCard() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery(prefsQuery());

  const update = useMutation({
    mutationFn: (patch: Partial<NotificationPrefs>) => accountApi.updatePrefs(patch),
    // Optimistic: flip the switch immediately, roll back if the request fails.
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: accountKeys.prefs });
      const prev = qc.getQueryData<NotificationPrefs>(accountKeys.prefs);
      if (prev) qc.setQueryData(accountKeys.prefs, { ...prev, ...patch });
      return { prev };
    },
    onError: (e: Error, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(accountKeys.prefs, ctx.prev);
      toast.error(e.message || "Couldn't save preference");
    },
    onSuccess: (next) => qc.setQueryData(accountKeys.prefs, next),
  });

  if (isLoading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !data) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        Couldn't load preferences.{" "}
        <button className="underline" onClick={() => refetch()}>Retry</button>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {ROWS.map((r) => (
        <li key={r.key} className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{r.label}</p>
            <p className="text-xs text-muted-foreground">{r.hint}</p>
          </div>
          <Switch
            checked={Boolean(data[r.key])}
            onCheckedChange={(v) => update.mutate({ [r.key]: v })}
            aria-label={r.label}
          />
        </li>
      ))}
    </ul>
  );
}
