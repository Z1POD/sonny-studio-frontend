// src/features/payment/components/PaymentPanel.tsx
//
// Whole payment step for one order, shared by checkout and the order sheet. The form is driven by
// the selected method (contract §17.1): reference / URL input, payer-account input, optional
// screenshot, and the merchant account(s) to pay into.
//   create attempt → verify →  verified | pending_review | failed/rejected
// Each stage is remembered, so a network failure resumes instead of creating a second attempt;
// after a failed/rejected verification the next submit starts a fresh attempt (new idempotency key).

"use client";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Copy, ImageUp, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { appToast as toast } from "@/lib/toaster";
import { uploadAsset } from "@/shared/api/assets";
import { cn } from "@/lib/utils";
import { paymentApi, type PaymentAttempt, type PaymentMethod } from "../api";

const label = (k: string) => k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

export type PaymentOutcome = "verified" | "pending_review";

interface Props {
  orderId: string;
  orderNumber: string;
  /** Display string for the amount due, e.g. "Br 440.00". */
  amountLabel: string;
  /** Called when the payment was verified, or accepted for manual review. */
  onDone: (outcome: PaymentOutcome) => void;
}

function Copyable({ value, name }: { value: string; name: string }) {
  return (
    <span className="flex items-center gap-1 font-mono">
      {value}
      <button
        type="button"
        aria-label={`Copy ${name}`}
        onClick={() => navigator.clipboard?.writeText(value).then(() => toast.success("Copied"))}
        className="grid h-8 w-8 place-items-center rounded-full hover:bg-background"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

export function PaymentPanel({ orderId, orderNumber, amountLabel, onDone }: Props) {
  const methodsQ = useQuery({
    queryKey: ["payment-methods", orderId],
    queryFn: () => paymentApi.methods(orderId),
    staleTime: 5 * 60_000,
  });
  const [methodId, setMethodId] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [account, setAccount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pct, setPct] = useState(0);
  const [step, setStep] = useState("");
  const [outcome, setOutcome] = useState<PaymentOutcome | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const progress = useRef<{ sig: string; key: string; attempt: PaymentAttempt | null }>({ sig: "", key: "", attempt: null });

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (!methodId && methodsQ.data?.length === 1) setMethodId(methodsQ.data[0]!.id);
  }, [methodsQ.data, methodId]);

  const method: PaymentMethod | undefined = methodsQ.data?.find((m) => m.id === methodId);
  const takesReference = !!method && (method.supportsTransactionId || method.supportsUrl);
  const takesScreenshot = !!method && method.supportsScreenshot;
  // A method that collects proof needs the reference, or a screenshot when it accepts one.
  const hasProof = !takesReference && !takesScreenshot ? true : identifier.trim().length > 0 || (takesScreenshot && !!file);
  const ready = !!method && hasProof && (!method.requiresAccountNumber || account.trim().length >= 4);

  const pay = useMutation({
    mutationFn: async (): Promise<PaymentAttempt> => {
      if (!method) throw new Error("Choose a payment method");
      const ident = identifier.trim();
      const sig = `${method.id}|${ident}|${account.trim()}|${file?.name ?? ""}|${file?.size ?? 0}`;
      if (progress.current.sig !== sig) progress.current = { sig, key: crypto.randomUUID(), attempt: null };
      const p = progress.current;

      if (!p.attempt) {
        let receiptAssetId: string | undefined;
        if (takesScreenshot && file) {
          setStep("Uploading screenshot…");
          receiptAssetId = (await uploadAsset(file, "payment_receipt", setPct)).id;
        }
        setStep("Creating payment…");
        p.attempt = await paymentApi.createAttempt({
          orderId,
          methodId: method.id,
          idempotencyKey: p.key,
          receiptIdentifier: ident || undefined,
          payerAccount: method.requiresAccountNumber ? account.trim() : undefined,
          receiptAssetId,
        });
      }
      setStep("Verifying payment…");
      return paymentApi.verify(p.attempt.id);
    },
    onSuccess: (a) => {
      if (a.status === "verified" || a.status === "pending_review") {
        const o: PaymentOutcome = a.status === "verified" ? "verified" : "pending_review";
        setFailure(null);
        setOutcome(o);
        onDone(o);
        return;
      }
      // failed / rejected: show why, and make the next submit a brand-new attempt.
      progress.current = { sig: "", key: "", attempt: null };
      setFailure(a.verificationMessage || "We couldn't verify this payment. Check the details and try again.");
    },
    onError: (e: Error) => {
      setPct(0);
      setFailure(e.message || "Payment not submitted");
    },
    onSettled: () => setStep(""),
  });

  if (outcome) {
    const review = outcome === "pending_review";
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center" role="status">
        {review ? <Clock className="h-12 w-12 text-amber-500" /> : <CheckCircle2 className="h-12 w-12 text-emerald-500" />}
        <p className="text-lg font-semibold">{review ? "Payment submitted for review" : "Payment verified"}</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          {review
            ? `Our team is checking your payment for order ${orderNumber}. We'll notify you as soon as it's confirmed.`
            : `Order ${orderNumber} is confirmed. We'll notify you as it progresses.`}
        </p>
      </div>
    );
  }

  if (methodsQ.isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (methodsQ.error) {
    return (
      <div className="space-y-3 py-8 text-center">
        <p className="text-sm text-destructive">{methodsQ.error.message}</p>
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => methodsQ.refetch()}>
          <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Try again
        </Button>
      </div>
    );
  }
  if (!methodsQ.data?.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No payment methods are available for this order yet.</p>;
  }

  const inputCls = "mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal outline-none focus:border-gold";

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-surface p-4 text-center">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Amount due</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{amountLabel}</p>
        <p className="mt-1 text-xs text-muted-foreground">Order {orderNumber}</p>
      </div>

      <div role="radiogroup" aria-label="Payment method" className="space-y-2">
        {methodsQ.data.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={methodId === m.id}
            onClick={() => { setMethodId(m.id); setFailure(null); }}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors",
              methodId === m.id ? "border-gold bg-gold/5" : "border-border bg-surface hover:border-gold/50",
            )}
          >
            {m.logoUrl && <img src={m.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg object-contain" loading="lazy" />}
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{m.name}</span>
              {m.description && <span className="mt-0.5 block text-xs text-muted-foreground">{m.description}</span>}
            </span>
          </button>
        ))}
      </div>

      {method && (
        <>
          {(method.merchantAccounts.length > 0 || Object.keys(method.display).length > 0) && (
            <div className="space-y-3 rounded-2xl bg-muted/40 p-3.5 text-sm">
              <p className="text-xs font-medium text-muted-foreground">Pay to</p>
              {Object.entries(method.display).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{label(k)}</span>
                  <span>{v}</span>
                </div>
              ))}
              {method.merchantAccounts.map((a, i) => (
                <div key={i} className="space-y-1 border-t border-border pt-2 first:border-0 first:pt-0">
                  {a.accountName && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Account name</span><span>{a.accountName}</span></div>}
                  {a.accountNumber && <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Account number</span><Copyable value={a.accountNumber} name="account number" /></div>}
                  {a.shortCode && <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Short code</span><Copyable value={a.shortCode} name="short code" /></div>}
                  {a.accountType && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Type</span><span>{a.accountType}</span></div>}
                </div>
              ))}
            </div>
          )}
          {method.instructions && <p className="text-sm">{method.instructions}</p>}
          {Number(method.feeAmount) > 0 && (
            <p className="text-xs text-muted-foreground">
              Fee: {method.feeIsPercentage ? `${method.feeAmount}%` : `${method.currencyCode} ${method.feeAmount}`}
            </p>
          )}

          {takesReference && (
            <label className="block text-sm font-medium">
              {method.receiptLabel}
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                maxLength={500}
                inputMode={method.supportsUrl ? "url" : "text"}
                autoCapitalize="characters"
                placeholder={method.receiptPlaceholder}
                className={inputCls}
              />
              {method.receiptHelpText && <span className="mt-1.5 block text-xs font-normal text-muted-foreground">{method.receiptHelpText}</span>}
            </label>
          )}

          {method.requiresAccountNumber && (
            <label className="block text-sm font-medium">
              {method.accountLabel}
              <input value={account} onChange={(e) => setAccount(e.target.value)} maxLength={40} inputMode="numeric" className={inputCls} />
            </label>
          )}

          {takesScreenshot && (
            <div>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border p-5 text-center hover:bg-muted/40">
                {preview ? (
                  <img src={preview} alt="Receipt preview" className="max-h-56 rounded-xl object-contain" />
                ) : (
                  <>
                    <ImageUp className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm font-medium">{takesReference ? "Or upload a screenshot" : "Upload receipt screenshot"}</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > MAX_RECEIPT_BYTES) return void toast.error("Image must be under 10 MB");
                    setFile(f);
                    setPreview(URL.createObjectURL(f));
                  }}
                />
              </label>
              {pay.isPending && step.startsWith("Uploading") && (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-gold transition-all" style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          )}

          {method.estimatedProcessingHours != null && method.estimatedProcessingHours > 0 && (
            <p className="text-xs text-muted-foreground">
              Usually confirmed within {method.estimatedProcessingHours} {method.estimatedProcessingHours === 1 ? "hour" : "hours"}.
            </p>
          )}

          {failure && (
            <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {failure}
            </p>
          )}

          <Button
            className="h-12 w-full rounded-2xl bg-gold text-sm font-semibold text-gold-foreground"
            disabled={!ready || pay.isPending}
            onClick={() => { setFailure(null); pay.mutate(); }}
          >
            {pay.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {pay.isPending ? step || "Working…" : failure ? "Try again" : method.kind === "cash_on_delivery" ? "Confirm cash on delivery" : "Submit payment"}
          </Button>
        </>
      )}
    </div>
  );
}
