// src/features/checkout/components/StepPayment.tsx

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Copy,
  Loader2,
  Shield,
  RefreshCw,
  X,
  ArrowLeft,
  AlertTriangle,
  CreditCard,
  Clock,
  Upload,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCheckoutStore } from "../store";
import { paymentApi, orderApi } from "../api";
import { toast } from "sonner";
import type { VerificationStatus } from "../types";

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -60 : 60,
    opacity: 0,
  }),
};

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_DURATION_MS = 120000; // 2 minutes

export function StepPayment() {
  const {
    order,
    selectedProviderCode,
    setSelectedProviderCode,
    receiptIdentifier,
    setReceiptIdentifier,
    payerAccount,
    setPayerAccount,
    submittingReceipt,
    setSubmittingReceipt,
    txRef,
    setTxRef,
    verifyState,
    setVerifyState,
    pollInterval,
    setPollInterval,
    setStep,
    reset,
  } = useCheckoutStore();

  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  const invoice = order?.invoice;
  const methods = invoice?.payment?.methods ?? [];
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
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  };

  const startPolling = (transactionId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    elapsedRef.current = 0;

    const poll = async () => {
      if (elapsedRef.current >= MAX_POLL_DURATION_MS) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setVerifyState({
          transactionId,
          status: "failed",
          statusDisplay: "Verification timed out",
          isVerified: false,
          isTerminal: true,
          amount: invoice?.amount?.total ?? "0",
          currency: invoice?.amount?.currency?.code ?? "ETB",
          provider: selectedMethod?.provider_name ?? "",
          receiptIdentifier: receiptIdentifier,
          errorMessage: "Verification took too long. Please contact support.",
          submittedAt: new Date().toISOString(),
        });
        return;
      }

      try {
        const v = await paymentApi.verify(transactionId);
        setVerifyState(v);

        if (v.isVerified || v.status === "verified") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          return;
        }

        if (v.isTerminal) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          return;
        }
      } catch (error) {
        console.error("Polling error:", error);
      }

      elapsedRef.current += POLL_INTERVAL_MS;
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    setPollInterval(pollRef.current as unknown as number);
  };

  const handleSubmitReceipt = async () => {
    if (!order || !selectedMethod) return;
    if (!receiptIdentifier.trim()) {
      toast.error("Please enter your transaction ID or receipt URL");
      return;
    }
    if (selectedMethod.requiresPayerAccount && !payerAccount.trim()) {
      toast.error(selectedMethod.payerAccountLabel ?? "Please enter your payer account");
      return;
    }

    setSubmittingReceipt(true);
    try {
      const submitted = await paymentApi.submitReceipt({
        order_id: order.id,
        provider: selectedProviderCode,
        receipt_identifier: receiptIdentifier.trim(),
        payer_account: payerAccount.trim() || undefined,
      });

      setTxRef(submitted.transactionId);
      setVerifyState({
        transactionId: submitted.transactionId,
        status: "submitted",
        statusDisplay: submitted.statusDisplay,
        isVerified: false,
        isTerminal: false,
        amount: submitted.amount,
        currency: submitted.currency,
        provider: submitted.provider,
        receiptIdentifier: receiptIdentifier,
        submittedAt: submitted.submittedAt,
      });

      startPolling(submitted.transactionId);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to submit receipt");
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
    setVerifyState(null);
    setReceiptIdentifier("");
    setPayerAccount("");
    setTxRef("");
    setShowReceiptForm(false);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // ─── Loading / No Invoice State ─────────────────────────────────────────
  if (!invoice) {
    return (
      <motion.div
        custom={1}
        variants={slideVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="flex h-full flex-col items-center justify-center py-12 text-center"
      >
        <div className="grid h-16 w-16 place-items-center rounded-full bg-muted">
          <CreditCard className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Payment details loading</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Please wait while we prepare your payment options.
        </p>
      </motion.div>
    );
  }

  // ─── Payment Instructions View ──────────────────────────────────────────
  if (!verifyState) {
    return (
      <motion.div
        custom={1}
        variants={slideVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="flex h-full flex-col"
      >
        {/* Amount Banner */}
        <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-900/30 via-emerald-800/10 to-emerald-950/40 p-4 text-center">
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/70">
            Transfer exactly
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-emerald-100">
            {invoice?.amount?.currency?.symbol}{invoice?.amount?.total}
          </p>
          {invoice?.payment?.warning && (
            <p className="mt-2 text-[11px] text-emerald-300/60">
              {invoice.payment.warning}
            </p>
          )}
        </div>

        {/* Provider Selection */}
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Choose your bank
          </p>
          {methods.length === 0 ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading payment methods…
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {methods.map((method) => (
                <button
                  key={method.provider_code}
                  onClick={() => {
                    setSelectedProviderCode(method.provider_code);
                    setReceiptIdentifier("");
                    setPayerAccount("");
                  }}
                  className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-all ${
                    selectedProviderCode === method.provider_code
                      ? "border-primary bg-primary/5"
                      : "border-border bg-surface hover:border-foreground/30"
                  }`}
                >
                  {method.provider_logo && (
                    <img
                      src={method.provider_logo}
                      alt={method.provider_name}
                      className="h-10 w-10 rounded-lg object-contain"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{method.provider_name}</p>
                    <p className="text-[11px] text-muted-foreground">{method.accountType}</p>
                  </div>
                  {selectedProviderCode === method.provider_code && (
                    <div className="grid h-5 w-5 place-items-center rounded-full bg-primary">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Method Details */}
        <AnimatePresence mode="wait">
          {selectedMethod && (
            <motion.div
              key={selectedMethod.provider_code}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 space-y-2 rounded-2xl border border-border bg-surface p-4"
            >
              <DetailRow
                label="Recipient"
                value={selectedMethod.account_name}
                onCopy={() => copyToClipboard(selectedMethod.account_name, "recipient")}
                copied={copiedField === "recipient"}
              />
              <DetailRow
                label="Account number"
                value={selectedMethod.account_number}
                onCopy={() => copyToClipboard(selectedMethod.account_number, "account")}
                copied={copiedField === "account"}
              />
              <DetailRow
                label="Amount"
                value={`${invoice?.amount?.currency?.symbol}${invoice?.amount?.total}`}
                onCopy={() => copyToClipboard(invoice?.amount?.total ?? "", "amount")}
                copied={copiedField === "amount"}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Receipt Submission Toggle */}
        <div className="mt-4 space-y-3">
          <button
            onClick={() => setShowReceiptForm((s) => !s)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm font-medium transition-all hover:bg-primary/10"
          >
            <Shield className="h-4 w-4" />
            {showReceiptForm ? "Hide verification" : "I've paid — verify now"}
          </button>

          <AnimatePresence mode="wait">
            {showReceiptForm && (
              <motion.div
                key="receipt-form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 rounded-2xl border border-border bg-surface p-4"
              >
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {selectedMethod?.referenceLabel ?? "Receipt identifier"}
                  </Label>
                  <Input
                    value={receiptIdentifier}
                    onChange={(e) => setReceiptIdentifier(e.target.value)}
                    placeholder={selectedMethod?.referencePlaceholder ?? "Enter transaction ID"}
                    className="h-12 rounded-xl border-border bg-surface"
                  />
                  {selectedMethod?.referenceHelpText && (
                    <p className="text-[11px] text-muted-foreground">
                      {selectedMethod.referenceHelpText}
                    </p>
                  )}
                </div>

                {selectedMethod?.requiresPayerAccount && (
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {selectedMethod.payerAccountLabel ?? "Your account number"}
                    </Label>
                    <Input
                      value={payerAccount}
                      onChange={(e) => setPayerAccount(e.target.value)}
                      placeholder="Last 8 digits"
                      className="h-12 rounded-xl border-border bg-surface"
                    />
                  </div>
                )}

                <Button
                  onClick={handleSubmitReceipt}
                  disabled={submittingReceipt || !receiptIdentifier.trim()}
                  className="w-full h-11 rounded-xl font-semibold"
                >
                  {submittingReceipt ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Submit receipt
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Cancel */}
        <div className="mt-3 flex justify-center">
          <button
            onClick={handleCancelOrder}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Cancel order
          </button>
        </div>
      </motion.div>
    );
  }

  // ─── Verifying View ─────────────────────────────────────────────────────
  if (verifyState.status === "submitted" || verifyState.status === "verifying") {
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
        <p className="mt-2 max-w-[240px] text-sm text-muted-foreground">
          {verifyState.statusDisplay}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          This usually takes 1-2 minutes
        </p>

        <div className="mt-6 rounded-xl border border-border bg-surface px-4 py-3 text-[11px] text-muted-foreground">
          <span className="font-mono">{verifyState.transactionId}</span>
        </div>
      </motion.div>
    );
  }

  // ─── Verified Success View ──────────────────────────────────────────────
  if (verifyState.isVerified || verifyState.status === "verified") {
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
          Your order <span className="font-mono font-medium">{order?.orderNumber}</span> is confirmed.
        </p>

        <div className="mt-6 space-y-2 w-full max-w-xs">
          <Button
            onClick={() => {
              window.location.href = `/orders`;
            }}
            className="w-full h-12 rounded-2xl text-base font-semibold"
          >
            <FileCheck className="mr-2 h-4 w-4" />
            Track order
          </Button>
          <Button
            variant="ghost"
            onClick={() => reset()}
            className="w-full h-10 text-sm text-muted-foreground"
          >
            Continue shopping
          </Button>
        </div>
      </motion.div>
    );
  }

  // ─── Failed / Mismatch View ─────────────────────────────────────────────
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

      <h3 className="mt-5 text-lg font-semibold">Could not verify</h3>
      <p className="mt-2 max-w-[280px] text-sm text-muted-foreground">
        {verifyState.errorMessage ?? "The receipt didn't match our records."}
      </p>

      <div className="mt-6 flex flex-col gap-2 w-full max-w-xs">
        <Button
          onClick={handleRetry}
          variant="outline"
          className="w-full h-11 rounded-xl font-medium"
        >
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

// ─── Sub-component: Detail Row with Copy ─────────────────────────────────

function DetailRow({
  label,
  value,
  onCopy,
  copied,
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
          className={`grid h-8 w-8 place-items-center rounded-full border transition-all ${
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