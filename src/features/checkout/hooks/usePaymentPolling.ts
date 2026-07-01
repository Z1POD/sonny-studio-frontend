// src/features/checkout/hooks/usePaymentPolling.ts

import { useRef, useCallback } from "react";
import { useCheckoutStore } from "../store";
import { paymentApi } from "../api";

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_DURATION_MS = 120_000;

export function usePaymentPolling() {
  const {
    invoice,
    selectedMethod,
    receiptIdentifier,
    setVerifyState,
    setPollInterval,
  } = useCheckoutStore();

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    elapsedRef.current = 0;
  }, []);

  const startPolling = useCallback(
    (transactionId: string) => {
      stopPolling();

      const poll = async () => {
        elapsedRef.current += POLL_INTERVAL_MS;

        if (elapsedRef.current > MAX_POLL_DURATION_MS) {
          stopPolling();
          setVerifyState({
            transactionId,
            status: "failed",
            statusDisplay: "Verification timed out",
            isVerified: false,
            isTerminal: true,
            amount: (invoice?.amount as any)?.total ?? "0",
            currency: (invoice?.amount as any)?.currency?.code ?? "ETB",
            provider:
              (selectedMethod as any)?.provider_name ??
              (selectedMethod as any)?.providerName ??
              "",
            receiptIdentifier,
            errorMessage:
              "Verification is taking too long. Please contact support.",
            submittedAt: new Date().toISOString(),
          });
          return;
        }

        try {
          const v = await paymentApi.verify(transactionId);
          setVerifyState(v);
          if (v.isTerminal) stopPolling();
        } catch (err) {
          console.warn("[StepPayment] poll error (will retry):", err);
        }
      };

      pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
      setPollInterval(
        pollRef.current as unknown as ReturnType<typeof setInterval>
      );
    },
    [stopPolling, invoice, selectedMethod, receiptIdentifier, setVerifyState, setPollInterval]
  );

  return { startPolling, stopPolling, pollRef };
}