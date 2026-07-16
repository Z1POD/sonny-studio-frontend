// src/features/payment/hooks/useReceiptValidation.ts

import { useState, useCallback } from "react";
import {
  validateReceiptField,
  validatePayerAccount,
} from "../lib/paymentValidation";
import type { ReceiptFieldType } from "../types";

export function useReceiptValidation(fieldType: ReceiptFieldType, requiresAccount: boolean) {
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [payerError, setPayerError] = useState<string | null>(null);

  const validate = useCallback(
    (receiptIdentifier: string, payerAccount: string) => {
      const rErr = validateReceiptField(receiptIdentifier, fieldType);
      const pErr = requiresAccount ? validatePayerAccount(payerAccount) : null;

      setReceiptError(rErr);
      setPayerError(pErr);

      return { isValid: !rErr && !pErr, rErr, pErr };
    },
    [fieldType, requiresAccount]
  );

  const clearErrors = useCallback(() => {
    setReceiptError(null);
    setPayerError(null);
  }, []);

  return {
    receiptError,
    payerError,
    validate,
    clearErrors,
    setReceiptError,
    setPayerError,
  };
}
