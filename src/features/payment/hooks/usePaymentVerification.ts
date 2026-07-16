// src/features/payment/hooks/usePaymentVerification.ts
//
// Store-agnostic version of what StepPayment used to hand-wire itself
// (submit receipt -> decide isTerminal -> poll -> stop). Owns its own local
// state so it can be dropped into any screen that needs "pay via bank
// transfer, submit a receipt, watch it get verified" — currently the
// checkout payment step and the order-detail sheet.

import { useCallback, useEffect, useRef, useState } from "react";
import { paymentApi } from "../api";
import { useReceiptValidation } from "./useReceiptValidation";
import { normalizePaymentMethod } from "../lib/normalize";
import type { ReceiptFieldType, VerificationStatus } from "../types";

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_DURATION_MS = 120_000;

interface UsePaymentVerificationOptions {
  /** The order this receipt is being submitted for. Submission is a no-op until this is set. */
  orderId: string | null | undefined;
  /** Raw payment methods, either camelCase (checkout) or snake_case (orders) shape — normalized internally. */
  methods: any[];
  /** Used to seed the "verifying" placeholder state before the first real response comes back. */
  fallbackAmount?: string;
  fallbackCurrency?: string;
  /** Called once, when a receipt resolves as verified (either immediately or via polling). */
  onVerified?: (status: VerificationStatus) => void;
}

export function usePaymentVerification({
  orderId,
  methods,
  fallbackAmount = "0",
  fallbackCurrency = "ETB",
  onVerified,
}: UsePaymentVerificationOptions) {
  const normalizedMethods = methods.map(normalizePaymentMethod);

  const [selectedProviderCode, setSelectedProviderCode] = useState<string>("");
  const [receiptIdentifier, setReceiptIdentifierRaw] = useState("");
  const [payerAccount, setPayerAccountRaw] = useState("");
  const [submittingReceipt, setSubmittingReceipt] = useState(false);
  const [verifyState, setVerifyState] = useState<VerificationStatus | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  // Auto-select the first available method once methods load.
  useEffect(() => {
    if (!selectedProviderCode && normalizedMethods.length > 0) {
      setSelectedProviderCode(normalizedMethods[0].providerCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedMethods.length, selectedProviderCode]);

  const selectedMethod = normalizedMethods.find(
    (m) => m.providerCode === selectedProviderCode
  );

  const fieldType: ReceiptFieldType =
    selectedMethod?.supportsUrl && selectedMethod?.supportsTransactionId
      ? "urlOrTransactionId"
      : selectedMethod?.supportsUrl
      ? "url"
      : "alphanumeric";

  const {
    receiptError,
    payerError,
    validate,
    clearErrors,
    setReceiptError,
    setPayerError,
  } = useReceiptValidation(fieldType, selectedMethod?.requiresPayerAccount ?? false);

  const setReceiptIdentifier = useCallback(
    (v: string) => {
      setReceiptIdentifierRaw(v);
      setReceiptError((prev) => (prev ? null : prev));
    },
    [setReceiptError]
  );

  const setPayerAccount = useCallback(
    (v: string) => {
      setPayerAccountRaw(v);
      setPayerError((prev) => (prev ? null : prev));
    },
    [setPayerError]
  );

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    elapsedRef.current = 0;
  }, []);

  // Cleanup on unmount.
  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPolling = useCallback(
    (transactionId: string) => {
      stopPolling();

      const poll = async () => {
        elapsedRef.current += POLL_INTERVAL_MS;

        if (elapsedRef.current > MAX_POLL_DURATION_MS) {
          stopPolling();
          setVerifyState((prev) => ({
            transactionId,
            status: "failed",
            statusDisplay: "Verification timed out",
            isVerified: false,
            isTerminal: true,
            amount: prev?.amount ?? fallbackAmount,
            currency: prev?.currency ?? fallbackCurrency,
            provider: prev?.provider ?? "",
            receiptIdentifier: prev?.receiptIdentifier ?? "",
            errorMessage: "Verification is taking too long. Please contact support.",
            submittedAt: new Date().toISOString(),
          }));
          return;
        }

        try {
          const v = await paymentApi.verify(transactionId);
          setVerifyState(v);
          if (v.isTerminal) {
            stopPolling();
            if (v.isVerified) onVerified?.(v);
          }
        } catch (err) {
          console.warn("[usePaymentVerification] poll error (will retry):", err);
        }
      };

      pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    },
    [stopPolling, fallbackAmount, fallbackCurrency, onVerified]
  );

  const submitReceipt = useCallback(async () => {
    if (!orderId || !selectedMethod) return;

    const { isValid } = validate(receiptIdentifier, payerAccount);
    if (!isValid) return;

    setSubmittingReceipt(true);
    setVerifyState({
      transactionId: "",
      status: "verifying",
      statusDisplay: "Checking with your bank…",
      isVerified: false,
      isTerminal: false,
      amount: fallbackAmount,
      currency: fallbackCurrency,
      provider: selectedMethod.providerName,
      receiptIdentifier: receiptIdentifier.trim(),
      submittedAt: new Date().toISOString(),
    });

    try {
      const submitted = await paymentApi.submitReceipt({
        order_id: orderId,
        provider: selectedProviderCode,
        receipt_identifier: receiptIdentifier.trim(),
        payer_account: payerAccount.trim() || undefined,
      });

      const nextState: VerificationStatus = {
        transactionId: submitted.transactionId,
        status: submitted.status as VerificationStatus["status"],
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
      };
      setVerifyState(nextState);

      if (submitted.isTerminal) {
        stopPolling();
        if (submitted.isVerified) onVerified?.(nextState);
      } else {
        startPolling(submitted.transactionId);
      }

      return nextState;
    } catch (e) {
      stopPolling();
      setVerifyState(null);
      throw e;
    } finally {
      setSubmittingReceipt(false);
    }
  }, [
    orderId,
    selectedMethod,
    selectedProviderCode,
    receiptIdentifier,
    payerAccount,
    validate,
    fallbackAmount,
    fallbackCurrency,
    startPolling,
    stopPolling,
    onVerified,
  ]);

  /** Reset back to the "not yet submitted" state — e.g. after a failed/mismatched verification. */
  const retry = useCallback(() => {
    stopPolling();
    setVerifyState(null);
    setReceiptIdentifierRaw("");
    setPayerAccountRaw("");
    clearErrors();
  }, [stopPolling, clearErrors]);

  return {
    methods: normalizedMethods,
    selectedMethod,
    selectedProviderCode,
    setSelectedProviderCode,

    receiptIdentifier,
    setReceiptIdentifier,
    payerAccount,
    setPayerAccount,
    receiptError,
    payerError,
    clearErrors,

    submittingReceipt,
    verifyState,
    submitReceipt,
    retry,
    stopPolling,
  };
}
