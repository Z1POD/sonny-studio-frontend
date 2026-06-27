// src/features/checkout/components/StepPayment.tsx — v2
/**
 * Fixes:
 *  1. submitReceipt response now maps is_verified, is_terminal, error_message,
 *     verified_at so terminal results are caught immediately — no spurious polling.
 *  2. UI transitions to "Verifying…" state immediately when the HTTP request
 *     starts (not after it resolves) so the user never sees a long "Submitting" spinner.
 *  3. Polling only starts when backend says is_terminal = false.
 *     When is_terminal = true the result is shown instantly (success or failure).
 *  4. Removed setStep (doesn't exist on store) — navigation uses reset() / href.
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Copy, Loader2, Shield, RefreshCw, X,
  AlertTriangle, Clock, Upload, FileCheck, Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCheckoutStore } from "../store";
import { paymentApi, orderApi } from "../api";
import { toast } from "sonner";

const POLL_INTERVAL_MS    = 3_000;
const MAX_POLL_DURATION_MS = 120_000; // 2 minutes

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isTerminalStatus(status: string) {
  return ["verified", "failed", "mismatch", "fraud", "expired"].includes(status);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StepPayment() {
  const {
    order,
    selectedProviderCode, setSelectedProviderCode,
    receiptIdentifier,    setReceiptIdentifier,
    payerAccount,         setPayerAccount,
    submittingReceipt,    setSubmittingReceipt,
    txRef,                setTxRef,
    verifyState,          setVerifyState,
    setPollInterval,
    reset,
  } = useCheckoutStore();

  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [copiedField, setCopiedField]         = useState<string | null>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  const invoice        = order?.invoice;
  const methods        = invoice?.payment?.methods ?? [];
  const selectedMethod = methods.find((m) => m.provider_code === selectedProviderCode);

  // Auto-select first provider
  useEffect(() => {
    if (!selectedProviderCode && methods.length > 0) {
      setSelectedProviderCode(methods[0].provider_code);
    }
  }, [methods, selectedProviderCode, setSelectedProviderCode]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, []);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2_000);
      toast.success("Copied");
    } catch { toast.error("Could not copy"); }
  };

  // ── Polling ────────────────────────────────────────────────────────────────
  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const startPolling = (transactionId: string) => {
    stopPolling();
    elapsedRef.current = 0;

    const poll = async () => {
      elapsedRef.current += POLL_INTERVAL_MS;

      if (elapsedRef.current > MAX_POLL_DURATION_MS) {
        stopPolling();
        setVerifyState({
          transactionId,
          status:            "failed",
          statusDisplay:     "Verification timed out",
          isVerified:        false,
          isTerminal:        true,
          amount:            invoice?.amount?.total ?? "0",
          currency:          invoice?.amount?.currency?.code ?? "ETB",
          provider:          selectedMethod?.provider_name ?? "",
          receiptIdentifier: receiptIdentifier,
          errorMessage:      "Verification took too long. Please contact support.",
          submittedAt:       new Date().toISOString(),
        });
        return;
      }

      try {
        const v = await paymentApi.verify(transactionId);
        setVerifyState(v);
        if (v.isTerminal) stopPolling();
      } catch (err) {
        console.error("[Payment] polling error:", err);
        // keep polling — transient network error
      }
    };

    // First tick immediately, then on interval
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    setPollInterval(pollRef.current as unknown as ReturnType<typeof setInterval>);
  };

  // ── Submit receipt ─────────────────────────────────────────────────────────
  const handleSubmitReceipt = async () => {
    if (!order || !selectedMethod) return;
    if (!receiptIdentifier.trim()) {
      toast.error("Please enter your transaction ID or receipt number");
      return;
    }
    if (selectedMethod.requiresPayerAccount && !payerAccount.trim()) {
      toast.error(selectedMethod.payerAccountLabel ?? "Please enter your account number");
      return;
    }

    // ── Immediately show "verifying" UI ──────────────────────────────────────
    // The backend verifies synchronously and can take a few seconds.
    // Show the verifying state NOW so the user isn't staring at a spinner
    // with no feedback on what's happening.
    setSubmittingReceipt(true);
    setVerifyState({
      transactionId:     "",
      status:            "verifying",
      statusDisplay:     "Checking with your bank…",
      isVerified:        false,
      isTerminal:        false,
      amount:            invoice?.amount?.total ?? "0",
      currency:          invoice?.amount?.currency?.code ?? "ETB",
      provider:          selectedMethod.provider_name,
      receiptIdentifier: receiptIdentifier.trim(),
      submittedAt:       new Date().toISOString(),
    });

    try {
      const submitted = await paymentApi.submitReceipt({
        order_id:           order.id,
        provider:           selectedProviderCode,
        receipt_identifier: receiptIdentifier.trim(),
        payer_account:      payerAccount.trim() || undefined,
      });

      setTxRef(submitted.transactionId);

      // Overwrite with the REAL state from the backend
      setVerifyState({
        transactionId:     submitted.transactionId,
        status:            submitted.status as any,
        statusDisplay:     submitted.statusDisplay,
        isVerified:        submitted.isVerified,
        isTerminal:        submitted.isTerminal,
        amount:            submitted.amount,
        currency:          submitted.currency,
        provider:          submitted.provider,
        receiptIdentifier: receiptIdentifier.trim(),
        errorMessage:      submitted.errorMessage,
        submittedAt:       submitted.submittedAt,
        verifiedAt:        submitted.verifiedAt,
      });

      if (submitted.isTerminal) {
        // Backend already resolved — no polling needed at all
        stopPolling();
      } else {
        // Backend is still processing — start polling
        startPolling(submitted.transactionId);
      }
    } catch (e: any) {
      // Reset verifyState so the form comes back
      setVerifyState(null);
      toast.error(e?.data?.error?.message ?? e?.message ?? "Failed to submit receipt");
    } finally {
      setSubmittingReceipt(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    try {
      await orderApi.cancel(order.id, "User cancelled from payment step");
      toast.success("Order cancelled");
      reset();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to cancel order");
    }
  };

  const handleRetry = () => {
    stopPolling();
    setVerifyState(null);
    setReceiptIdentifier("");
    setPayerAccount("");
    setTxRef("");
    setShowReceiptForm(false);
  };

  // ─── No invoice ────────────────────────────────────────────────────────────
  if (!invoice) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Loading payment details…</p>
      </div>
    );
  }

  const sym   = invoice.amount?.currency?.symbol ?? "Br";
  const total = invoice.amount?.total ?? "0";

  // ─── Verifying / Submitted state ───────────────────────────────────────────
  if (verifyState && (verifyState.status === "submitted" || verifyState.status === "verifying")) {
    return (
      <motion.div
        key="verifying"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex h-full flex-col items-center justify-center py-12 text-center"
      >
        <div className="relative">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-primary/10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <div className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-primary">
            <Clock className="h-3 w-3 text-primary-foreground" />
          </div>
        </div>

        <h3 className="mt-6 text-xl font-semibold">Verifying payment</h3>
        <p className="mt-2 max-w-[260px] text-sm text-muted-foreground">
          {verifyState.statusDisplay}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground/60">
          This usually takes under a minute
        </p>

        {verifyState.transactionId && (
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3">
            <Wifi className="h-3.5 w-3.5 text-primary animate-pulse" />
            <span className="font-mono text-[11px] text-muted-foreground">
              {verifyState.transactionId}
            </span>
          </div>
        )}

        <p className="mt-4 text-[10px] text-muted-foreground/50">
          Don't close this screen
        </p>
      </motion.div>
    );
  }

  // ─── Verified success ───────────────────────────────────────────────────────
  if (verifyState && (verifyState.isVerified || verifyState.status === "verified")) {
    return (
      <motion.div
        key="success"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex h-full flex-col items-center justify-center py-12 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
          className="grid h-20 w-20 place-items-center rounded-full bg-green-500"
        >
          <Check className="h-10 w-10 text-white" strokeWidth={3} />
        </motion.div>

        <h3 className="mt-6 text-2xl font-bold tracking-tight">Payment confirmed</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Order <span className="font-mono font-medium">{order?.orderNumber}</span> is confirmed.
        </p>

        <div className="mt-6 flex flex-col gap-2 w-full max-w-xs">
          <Button
            onClick={() => { reset(); window.location.href = "/orders"; }}
            className="w-full h-12 rounded-2xl text-base font-semibold"
          >
            <FileCheck className="mr-2 h-4 w-4" />
            Track order
          </Button>
          <Button variant="ghost" onClick={reset} className="w-full h-10 text-sm text-muted-foreground">
            Continue shopping
          </Button>
        </div>
      </motion.div>
    );
  }

  // ─── Failed / Mismatch ──────────────────────────────────────────────────────
  if (verifyState && verifyState.isTerminal) {
    return (
      <motion.div
        key="failed"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex h-full flex-col items-center justify-center py-10 text-center"
      >
        <div className="grid h-16 w-16 place-items-center rounded-full bg-destructive/15">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="mt-5 text-lg font-semibold">
          {verifyState.status === "mismatch" ? "Payment mismatch" : "Could not verify"}
        </h3>
        <p className="mt-2 max-w-[280px] text-sm text-muted-foreground">
          {verifyState.errorMessage ?? "The receipt didn't match our records."}
        </p>
        <div className="mt-6 flex flex-col gap-2 w-full max-w-xs">
          <Button onClick={handleRetry} variant="outline" className="w-full h-11 rounded-xl font-medium">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
          <Button
            onClick={handleCancelOrder}
            variant="ghost"
            className="w-full h-10 text-sm text-destructive hover:text-destructive"
          >
            <X className="mr-2 h-4 w-4" />
            Cancel order
          </Button>
        </div>
      </motion.div>
    );
  }

  // ─── Payment instructions (default state) ──────────────────────────────────
  return (
    <motion.div
      key="instructions"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex h-full flex-col"
    >
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 no-scrollbar">

        {/* Amount highlight */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 text-center">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Amount to send
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            {sym}&nbsp;{total}
          </p>
          <p className="mt-1 text-[11px] text-amber-600 font-medium">
            Send the exact amount shown
          </p>
        </div>

        {/* Instructions */}
        {invoice.payment?.instructions && (
          <p className="text-sm text-muted-foreground text-center leading-relaxed px-2">
            {invoice.payment.instructions}
          </p>
        )}
        {invoice.payment?.warning && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
            <p className="text-[11px] text-amber-700">{invoice.payment.warning}</p>
          </div>
        )}

        {/* Bank selector */}
        {methods.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground px-1">
              Pay via
            </p>
            {methods.map((method) => {
              const isSelected = method.provider_code === selectedProviderCode;
              return (
                <button
                  key={method.provider_code}
                  onClick={() => setSelectedProviderCode(method.provider_code)}
                  className={`w-full text-left rounded-2xl border-2 p-4 transition ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border bg-surface hover:border-border/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {method.provider_logo && (
                      <img
                        src={method.provider_logo}
                        alt={method.provider_name}
                        className="h-8 w-8 rounded-lg object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{method.provider_name}</p>
                      <p className="text-xs text-muted-foreground">{method.account_type}</p>
                    </div>
                    <div className={`h-4 w-4 rounded-full border-2 transition ${
                      isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                    }`} />
                  </div>

                  {/* Account details — shown when selected */}
                  {isSelected && (
                    <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
                      <DetailRow
                        label="Account name"
                        value={method.account_name}
                      />
                      <DetailRow
                        label="Account number"
                        value={method.account_number}
                        onCopy={() => copyToClipboard(method.account_number, "account")}
                        copied={copiedField === "account"}
                      />
                      {method.account_type && (
                        <DetailRow label="Account type" value={method.account_type} />
                      )}
                      <DetailRow
                        label="Amount"
                        value={`${sym} ${total}`}
                        onCopy={() => copyToClipboard(total, "amount")}
                        copied={copiedField === "amount"}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Receipt submission */}
        <div className="space-y-3">
          <button
            onClick={() => setShowReceiptForm((s) => !s)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm font-medium transition-all hover:bg-primary/10"
          >
            <Shield className="h-4 w-4" />
            {showReceiptForm ? "Hide form" : "I've paid — submit receipt"}
          </button>

          <AnimatePresence>
            {showReceiptForm && (
              <motion.div
                key="receipt-form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {selectedMethod?.reference?.label ?? selectedMethod?.referenceLabel ?? "Receipt / Transaction ID"}
                    </Label>
                    <Input
                      value={receiptIdentifier}
                      onChange={(e) => setReceiptIdentifier(e.target.value)}
                      placeholder={selectedMethod?.reference?.placeholder ?? selectedMethod?.referencePlaceholder ?? "Enter transaction ID"}
                      className="h-12 rounded-xl border-border bg-background font-mono text-sm"
                    />
                    {(selectedMethod?.reference?.help_text ?? selectedMethod?.referenceHelpText) && (
                      <p className="text-[11px] text-muted-foreground">
                        {selectedMethod?.reference?.help_text ?? selectedMethod?.referenceHelpText}
                      </p>
                    )}
                  </div>

                  {(selectedMethod?.requires_payer_account ?? selectedMethod?.requiresPayerAccount) && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        {selectedMethod?.payer_account_label ?? selectedMethod?.payerAccountLabel ?? "Your account number"}
                      </Label>
                      <Input
                        value={payerAccount}
                        onChange={(e) => setPayerAccount(e.target.value)}
                        placeholder="e.g. last 4 digits"
                        className="h-12 rounded-xl border-border bg-background font-mono text-sm"
                      />
                    </div>
                  )}

                  <Button
                    onClick={handleSubmitReceipt}
                    disabled={submittingReceipt || !receiptIdentifier.trim()}
                    className="w-full h-11 rounded-xl font-semibold"
                  >
                    {submittingReceipt ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</>
                    ) : (
                      <><Upload className="mr-2 h-4 w-4" />Submit receipt</>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Cancel */}
        <div className="flex justify-center pt-1">
          <button
            onClick={handleCancelOrder}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Cancel order
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Detail row ────────────────────────────────────────────────────────────────

function DetailRow({
  label, value, onCopy, copied,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold tabular-nums">{value}</p>
      </div>
      {onCopy && (
        <button
          onClick={onCopy}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-all ${
            copied
              ? "border-green-500/50 bg-green-500/10 text-green-600"
              : "border-border bg-background text-muted-foreground hover:text-foreground"
          }`}
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}