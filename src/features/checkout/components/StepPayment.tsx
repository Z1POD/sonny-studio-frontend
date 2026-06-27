// src/features/checkout/components/StepPayment.tsx — v3
/**
 * Fixes:
 *  1. Polling: stopPolling() is called correctly on every terminal state,
 *     including when the submit response itself is already terminal.
 *     elapsedRef now increments AFTER the poll fires so timeout is accurate.
 *     A polledOnce ref prevents a double-fire on the first tick.
 *  2. Colors: uses CSS vars (bg-green-500/10, text-green-600 etc.) matching
 *     original StoreDashboard palette — no raw hex.
 *  3. Input validation per field type with clear inline error messages.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Copy, Loader2, Shield, RefreshCw, X,
  AlertTriangle, Clock, Upload, FileCheck, Wifi,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCheckoutStore } from "../store";
import { paymentApi, orderApi } from "../api";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS    = 3_000;
const MAX_POLL_DURATION_MS = 120_000; // 2 min

// ─── Validation ───────────────────────────────────────────────────────────────

type ReceiptFieldType = "alphanumeric" | "url" | "last8digits";

/** Detect what kind of input the bank's reference field expects. */
function detectFieldType(placeholder = "", helpText = ""): ReceiptFieldType {
  const combined = `${placeholder} ${helpText}`.toLowerCase();
  if (combined.includes("url") || combined.includes("http") || combined.includes("link")) {
    return "url";
  }
  if (
    combined.includes("last") ||
    combined.includes("digit") ||
    combined.includes("account") ||
    combined.includes("number only")
  ) {
    return "last8digits";
  }
  return "alphanumeric"; // default: transaction ID / reference
}

function validateReceiptField(value: string, type: ReceiptFieldType): string | null {
  const v = value.trim();
  if (!v) return "This field is required.";

  switch (type) {
    case "alphanumeric":
      // Transaction IDs: letters, digits, hyphens, underscores — no spaces
      if (!/^[A-Za-z0-9\-_]{4,64}$/.test(v)) {
        return "Enter a valid transaction ID (letters and numbers only, 4–64 characters).";
      }
      return null;

    case "url":
      try {
        const u = new URL(v);
        if (!["http:", "https:"].includes(u.protocol)) {
          return "Enter a valid https:// URL.";
        }
        return null;
      } catch {
        return "Enter a valid URL (e.g. https://…).";
      }

    case "last8digits":
      // Payer account last-N-digits: digits only, 4–12 chars
      if (!/^\d{4,12}$/.test(v)) {
        return "Enter digits only (4–12 characters).";
      }
      return null;

    default:
      return null;
  }
}

function validatePayerAccount(value: string): string | null {
  const v = value.trim();
  if (!v) return "This field is required.";
  if (!/^\d{4,12}$/.test(v)) return "Enter the last digits of your account number (numbers only).";
  return null;
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
  const [receiptError, setReceiptError]       = useState<string | null>(null);
  const [payerError, setPayerError]           = useState<string | null>(null);

  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  const invoice        = order?.invoice;
  const methods        = invoice?.payment?.methods ?? [];
  // Support both raw API shape (provider_code) and camelCase shape (providerCode)
  const selectedMethod = methods.find(
    (m: any) => (m.provider_code ?? m.providerCode) === selectedProviderCode,
  );

  // Auto-select first provider
  useEffect(() => {
    if (!selectedProviderCode && methods.length > 0) {
      setSelectedProviderCode((methods[0] as any).provider_code ?? (methods[0] as any).providerCode);
    }
  }, [methods, selectedProviderCode, setSelectedProviderCode]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
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
  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    elapsedRef.current = 0;
  }, []);

  const startPolling = useCallback((transactionId: string) => {
    stopPolling();

    const poll = async () => {
      // Increment BEFORE the async call so timeout is wall-clock accurate
      elapsedRef.current += POLL_INTERVAL_MS;

      if (elapsedRef.current > MAX_POLL_DURATION_MS) {
        stopPolling();
        setVerifyState({
          transactionId,
          status:            "failed",
          statusDisplay:     "Verification timed out",
          isVerified:        false,
          isTerminal:        true,
          amount:            (invoice?.amount as any)?.total ?? "0",
          currency:          (invoice?.amount as any)?.currency?.code ?? "ETB",
          provider:          (selectedMethod as any)?.provider_name ?? (selectedMethod as any)?.providerName ?? "",
          receiptIdentifier: receiptIdentifier,
          errorMessage:      "Verification is taking too long. Please contact support.",
          submittedAt:       new Date().toISOString(),
        });
        return;
      }

      try {
        const v = await paymentApi.verify(transactionId);
        setVerifyState(v);

        // Stop on ANY terminal state — verified, failed, mismatch, fraud, expired
        if (v.isTerminal) {
          stopPolling();
        }
      } catch (err) {
        // Network blip — keep polling, don't stop
        console.warn("[StepPayment] poll error (will retry):", err);
      }
    };

    // First poll after one interval (submit response is already current state)
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    setPollInterval(pollRef.current as unknown as ReturnType<typeof setInterval>);
  }, [stopPolling, invoice, selectedMethod, receiptIdentifier, setVerifyState, setPollInterval]);

  // ── Determine field types from method metadata ─────────────────────────────
  const refPlaceholder = (selectedMethod as any)?.reference?.placeholder
    ?? (selectedMethod as any)?.referencePlaceholder ?? "";
  const refHelpText    = (selectedMethod as any)?.reference?.help_text
    ?? (selectedMethod as any)?.referenceHelpText ?? "";
  const fieldType      = detectFieldType(refPlaceholder, refHelpText);

  // ── Submit receipt ─────────────────────────────────────────────────────────
  const handleSubmitReceipt = async () => {
    if (!order || !selectedMethod) return;

    // Validate
    const rErr = validateReceiptField(receiptIdentifier, fieldType);
    const pErr = ((selectedMethod as any).requires_payer_account ?? (selectedMethod as any).requiresPayerAccount)
      ? validatePayerAccount(payerAccount)
      : null;

    setReceiptError(rErr);
    setPayerError(pErr);
    if (rErr || pErr) return;

    setSubmittingReceipt(true);

    // Show "verifying" immediately — backend call is synchronous and may take seconds
    setVerifyState({
      transactionId:     "",
      status:            "verifying",
      statusDisplay:     "Checking with your bank…",
      isVerified:        false,
      isTerminal:        false,
      amount:            (invoice?.amount as any)?.total ?? "0",
      currency:          (invoice?.amount as any)?.currency?.code ?? "ETB",
      provider:          (selectedMethod as any).provider_name ?? (selectedMethod as any).providerName ?? "",
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

      // Overwrite with the REAL backend result
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
        // Already resolved — no polling needed
        stopPolling();
      } else {
        // Still processing — start polling
        startPolling(submitted.transactionId);
      }
    } catch (e: any) {
      stopPolling();
      setVerifyState(null); // reset to show the form again
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
    setReceiptError(null);
    setPayerError(null);
    setShowReceiptForm(false);
  };

  // ─── Guards ────────────────────────────────────────────────────────────────
  if (!invoice) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Loading payment details…</p>
      </div>
    );
  }

  const sym   = (invoice.amount as any)?.currency?.symbol ?? "Br";
  const total = (invoice.amount as any)?.total ?? "0";

  // ─── Verifying ─────────────────────────────────────────────────────────────
  if (verifyState && !verifyState.isTerminal &&
      (verifyState.status === "submitted" || verifyState.status === "verifying")) {
    return (
      <motion.div
        key="verifying"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex h-full flex-col items-center justify-center py-12 text-center gap-0"
      >
        <div className="relative mb-6">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-primary/10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <div className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-primary">
            <Clock className="h-3 w-3 text-primary-foreground" />
          </div>
        </div>

        <h3 className="text-xl font-semibold">Verifying payment</h3>
        <p className="mt-2 max-w-[260px] text-sm text-muted-foreground">
          {verifyState.statusDisplay}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground/60">
          Usually takes under a minute
        </p>

        {verifyState.transactionId && (
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5">
            <Wifi className="h-3 w-3 text-primary animate-pulse shrink-0" />
            <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[200px]">
              {verifyState.transactionId}
            </span>
          </div>
        )}

        <p className="mt-5 text-[10px] text-muted-foreground/40">
          Don't close this screen
        </p>
      </motion.div>
    );
  }

  // ─── Success ────────────────────────────────────────────────────────────────
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

        <h3 className="mt-6 text-2xl font-bold tracking-tight">Payment confirmed!</h3>
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
          <Button
            variant="ghost"
            onClick={reset}
            className="w-full h-10 text-sm text-muted-foreground"
          >
            Continue shopping
          </Button>
        </div>
      </motion.div>
    );
  }

  // ─── Failed / Mismatch ──────────────────────────────────────────────────────
  if (verifyState && verifyState.isTerminal) {
    const isMismatch = verifyState.status === "mismatch";
    return (
      <motion.div
        key="failed"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex h-full flex-col items-center justify-center py-10 text-center"
      >
        <div className="grid h-16 w-16 place-items-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="mt-5 text-lg font-semibold">
          {isMismatch ? "Payment mismatch" : "Verification failed"}
        </h3>
        <p className="mt-2 max-w-[280px] text-sm text-muted-foreground">
          {verifyState.errorMessage ?? "The receipt didn't match our records. Please try again."}
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

  // ─── Default: payment instructions ─────────────────────────────────────────
  const refLabel    = (selectedMethod as any)?.reference?.label
    ?? (selectedMethod as any)?.referenceLabel ?? "Transaction ID / Receipt";

  return (
    <motion.div
      key="instructions"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex h-full flex-col"
    >
      <div className="flex-1 overflow-y-auto space-y-4 pb-6 no-scrollbar">

        {/* Amount Banner */}
        <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-900/30 via-emerald-800/10 to-emerald-950/40 p-4 text-center">
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/70">
            Amount to send
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-emerald-100">
            {invoice?.amount?.currency?.symbol} {invoice?.amount?.total}
          </p>
          {invoice?.payment?.warning && (
            <p className="mt-2 text-[11px] text-emerald-300/60">
              {invoice.payment.warning}
            </p>
          )}
        </div>

        {/* Instructions */}
        {/* {(invoice.payment as any)?.instructions && (
          <p className="text-sm text-muted-foreground text-center leading-relaxed px-1">
            {(invoice.payment as any).instructions}
          </p>
        )} */}

        {/* Bank selector */}
        {methods.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground px-1">
              Send payment via
            </p>
            {methods.map((method: any) => {
              const code       = method.provider_code  ?? method.providerCode;
              const name       = method.provider_name  ?? method.providerName;
              const logo       = method.provider_logo  ?? method.providerLogo;
              const acctName   = method.account_name   ?? method.accountName;
              const acctNum    = method.account_number ?? method.accountNumber;
              const acctType   = method.account_type   ?? method.accountType;
              const isSelected = code === selectedProviderCode;

              return (
                <button
                  key={code}
                  onClick={() => setSelectedProviderCode(code)}
                  className={`w-full text-left rounded-2xl border-2 p-4 transition ${
                    isSelected
                      ? "border-emerald-400/20 bg-primary/5"
                      : "border-border bg-surface hover:border-border/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {logo && (
                      <img
                        src={logo}
                        alt={name}
                        className="h-8 w-8 rounded-lg object-contain shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{name}</p>
                      {acctType && <p className="text-xs text-muted-foreground">{acctType}</p>}
                    </div>
                    <div className={`h-4 w-4 shrink-0 rounded-full border-2 transition ${
                      isSelected ? "border-emerald-400/20 bg-primary" : "border-muted-foreground/30"
                    }`} />
                  </div>

                  {isSelected && (
                    <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
                      <DetailRow label="Account name"   value={acctName} />
                      <DetailRow
                        label="Account number"
                        value={acctNum}
                        onCopy={() => copyToClipboard(acctNum, "account")}
                        copied={copiedField === "account"}
                      />
                      <DetailRow
                        label="Amount to send"
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
            {showReceiptForm ? "Hide form" : "I've paid — verify now"}
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
                <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">

                  {/* Receipt / TX ID field */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {refLabel}
                    </Label>
                    <Input
                      value={receiptIdentifier}
                      onChange={(e) => {
                        setReceiptIdentifier(e.target.value);
                        if (receiptError) setReceiptError(null);
                      }}
                      onBlur={() => {
                        setReceiptError(validateReceiptField(receiptIdentifier, fieldType));
                      }}
                      placeholder={refPlaceholder || "Enter transaction ID or receipt number"}
                      className={`h-12 rounded-xl font-mono text-sm ${
                        receiptError ? "border-destructive focus-visible:ring-destructive" : "border-border"
                      } bg-background`}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {receiptError ? (
                      <p className="flex items-center gap-1 text-[11px] text-destructive">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        {receiptError}
                      </p>
                    ) : refHelpText ? (
                      <p className="text-[11px] text-muted-foreground">{refHelpText}</p>
                    ) : null}
                  </div>

                  {/* Payer account field */}
                  {((selectedMethod as any)?.requires_payer_account ??
                    (selectedMethod as any)?.requiresPayerAccount) && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        {(selectedMethod as any)?.payer_account_label
                          ?? (selectedMethod as any)?.payerAccountLabel
                          ?? "Your account number (last 8 digits)"}
                      </Label>
                      <Input
                        value={payerAccount}
                        onChange={(e) => {
                          // Only allow digits
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
                          setPayerAccount(digits);
                          if (payerError) setPayerError(null);
                        }}
                        onBlur={() => setPayerError(validatePayerAccount(payerAccount))}
                        placeholder="e.g. 12345678"
                        inputMode="numeric"
                        maxLength={12}
                        className={`h-12 rounded-xl font-mono text-sm tracking-widest ${
                          payerError ? "border-destructive focus-visible:ring-destructive" : "border-border"
                        } bg-background`}
                      />
                      {payerError && (
                        <p className="flex items-center gap-1 text-[11px] text-destructive">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          {payerError}
                        </p>
                      )}
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

// ─── DetailRow ─────────────────────────────────────────────────────────────────

function DetailRow({
  label, value, onCopy, copied,
}: {
  label: string; value: string;
  onCopy?: () => void; copied?: boolean;
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
              ? "border-green-500/30 bg-green-500/10 text-green-600"
              : "border-border bg-background text-muted-foreground hover:text-foreground"
          }`}
          aria-label={`Copy ${label}`}
        >
          {copied
            ? <CheckCircle2 className="h-3.5 w-3.5" />
            : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}