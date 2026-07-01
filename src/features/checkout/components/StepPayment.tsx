// src/features/checkout/components/StepPayment.tsx

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useCheckoutStore } from "../store";
import { orderApi } from "../api";
import { toast } from "sonner";
import { useClipboardCopy } from "../hooks/useClipboardCopy";
import { usePaymentPolling } from "../hooks/usePaymentPolling";
import { useReceiptValidation } from "../hooks/useReceiptValidation";
import type { ReceiptFieldType } from "../lib/paymentValidation";
import {
  AmountBanner,
  BankSelector,
  ReceiptSubmission,
  VerifyingState,
  SuccessState,
  FailedState,
} from "./payment";

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
    reset,
  } = useCheckoutStore();

  const [isCanceling, setIsCanceling] = useState(false);
  const navigate = useNavigate();
  const { copiedField, copy } = useClipboardCopy();
  const { startPolling, stopPolling } = usePaymentPolling();

  const invoice = order?.invoice;
  const methods = invoice?.payment?.methods ?? [];

  const selectedMethod = methods.find(
    (m: any) => (m.provider_code ?? m.providerCode) === selectedProviderCode
  );

  // Determine field type
  const supportsUrl = selectedMethod?.supports_url ?? false;
  const supportsTransactionId = selectedMethod?.supports_transaction_id ?? true;
  let fieldType: ReceiptFieldType;
  if (supportsUrl && supportsTransactionId) fieldType = "urlOrTransactionId";
  else if (supportsUrl) fieldType = "url";
  else fieldType = "alphanumeric";

  const requiresAccountNumber =
    selectedMethod?.requires_account_number ??
    selectedMethod?.requires_payer_account ??
    selectedMethod?.requiresPayerAccount ??
    false;

  const {
    receiptError,
    payerError,
    validate,
    clearErrors,
    setReceiptError,
    setPayerError,
  } = useReceiptValidation(fieldType, requiresAccountNumber);

  // Auto-select first provider
  useEffect(() => {
    if (!selectedProviderCode && methods.length > 0) {
      setSelectedProviderCode(
        methods[0].provider_code ?? methods[0].providerCode
      );
    }
  }, [methods, selectedProviderCode, setSelectedProviderCode]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleSubmitReceipt = async () => {
    if (!order || !selectedMethod) return;

    const { isValid } = validate(receiptIdentifier, payerAccount);
    if (!isValid) return;

    setSubmittingReceipt(true);
    setVerifyState({
      transactionId: "",
      status: "verifying",
      statusDisplay: "Checking with your bank…",
      isVerified: false,
      isTerminal: false,
      amount: invoice?.amount?.total ?? "0",
      currency: invoice?.amount?.currency?.code ?? "ETB",
      provider:
        selectedMethod.provider_name ?? selectedMethod.providerName ?? "",
      receiptIdentifier: receiptIdentifier.trim(),
      submittedAt: new Date().toISOString(),
    });

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
        status: submitted.status as any,
        statusDisplay: submitted.statusDisplay,
        isVerified: submitted.isVerified,
        isTerminal: submitted.isTerminal,
        amount: submitted.amount,
        currency: submitted.currency,
        provider: submitted.provider,
        receiptIdentifier: receiptIdentifier.trim(),
        errorMessage: submitted.errorMessage,
        submittedAt: submitted.submittedAt,
        verifiedAt: submitted.verifiedAt,
      });

      if (submitted.isTerminal) {
        stopPolling();
      } else {
        startPolling(submitted.transactionId);
      }
    } catch (e: any) {
      stopPolling();
      setVerifyState(null);
      toast.error(e?.data?.error?.message ?? e?.message ?? "Failed to submit receipt");
    } finally {
      setSubmittingReceipt(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order || isCanceling) return;
    setIsCanceling(true);
    try {
      await orderApi.cancel(order.id, "User cancelled from payment step");
      toast.success("Order cancelled");
      reset();
      navigate({ to: "/designs" });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to cancel order");
      reset();
      navigate({ to: "/designs" });
    } finally {
      setIsCanceling(false);
    }
  };

  const handleRetry = () => {
    stopPolling();
    setVerifyState(null);
    setReceiptIdentifier("");
    setPayerAccount("");
    setTxRef("");
    clearErrors();
  };

  // Guards
  if (!invoice) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">
          Loading payment details…
        </p>
      </div>
    );
  }

  const sym = invoice.amount?.currency?.symbol ?? "Br";
  const total = invoice.amount?.total ?? "0";

  // State branches
  if (verifyState && !verifyState.isTerminal &&
      (verifyState.status === "submitted" || verifyState.status === "verifying")) {
    return (
      <VerifyingState
        statusDisplay={verifyState.statusDisplay}
        transactionId={verifyState.transactionId}
      />
    );
  }

  if (verifyState && (verifyState.isVerified || verifyState.status === "verified")) {
    return <SuccessState orderNumber={order?.orderNumber} />;
  }

  if (verifyState && verifyState.isTerminal) {
    return (
      <FailedState
        isMismatch={verifyState.status === "mismatch"}
        errorMessage={verifyState.errorMessage}
        onRetry={handleRetry}
        onCancel={handleCancelOrder}
        isCanceling={isCanceling}
      />
    );
  }

  // Default: payment instructions
  const refLabel =
    selectedMethod?.reference?.label ??
    selectedMethod?.referenceLabel ??
    "Transaction ID / Receipt";

  const refPlaceholder =
    selectedMethod?.reference?.placeholder ??
    selectedMethod?.referencePlaceholder ??
    "";

  const refHelpText =
    selectedMethod?.reference?.help_text ??
    selectedMethod?.referenceHelpText ??
    "";

  const payerAccountLabel =
    selectedMethod?.payer_account_label ??
    selectedMethod?.payerAccountLabel ??
    "Your account number (last 8 digits)";

  return (
    <motion.div
      key="instructions"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex h-full flex-col"
    >
      <div className="flex-1 overflow-y-auto space-y-4 pb-6 no-scrollbar">
        <AmountBanner invoice={invoice} />

        <BankSelector
          methods={methods}
          selectedProviderCode={selectedProviderCode}
          onSelect={setSelectedProviderCode}
          onCopy={copy}
          copiedField={copiedField}
          sym={sym}
          total={total}
        />

        <ReceiptSubmission
          onSubmit={handleSubmitReceipt}
          receiptIdentifier={receiptIdentifier}
          setReceiptIdentifier={(v) => {
            setReceiptIdentifier(v);
            if (receiptError) setReceiptError(null);
          }}
          payerAccount={payerAccount}
          setPayerAccount={(v) => {
            setPayerAccount(v);
            if (payerError) setPayerError(null);
          }}
          receiptError={receiptError}
          payerError={payerError}
          refLabel={refLabel}
          refPlaceholder={refPlaceholder}
          refHelpText={refHelpText}
          requiresAccountNumber={requiresAccountNumber}
          payerAccountLabel={payerAccountLabel}
          submittingReceipt={submittingReceipt}
          clearErrors={clearErrors}
        />

        <div className="flex justify-center pt-1">
          <button
            onClick={handleCancelOrder}
            disabled={isCanceling}
            className={`text-xs transition-colors ${
              isCanceling
                ? "text-muted-foreground/50 cursor-not-allowed"
                : "text-muted-foreground hover:text-destructive"
            }`}
          >
            {isCanceling ? "Canceling order..." : "Cancel order"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}