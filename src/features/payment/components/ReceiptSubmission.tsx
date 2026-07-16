// src/features/payment/components/ReceiptSubmission.tsx

import { useState } from "react";
import { Shield } from "lucide-react";
import { ReceiptDialog } from "./ReceiptDialog";

interface ReceiptSubmissionProps {
  onSubmit: () => void;
  receiptIdentifier: string;
  setReceiptIdentifier: (v: string) => void;
  payerAccount: string;
  setPayerAccount: (v: string) => void;
  receiptError: string | null;
  payerError: string | null;
  refLabel: string;
  refPlaceholder: string;
  refHelpText: string;
  requiresAccountNumber: boolean;
  payerAccountLabel: string;
  submittingReceipt: boolean;
  clearErrors: () => void;
}

export function ReceiptSubmission({
  onSubmit,
  receiptIdentifier,
  setReceiptIdentifier,
  payerAccount,
  setPayerAccount,
  receiptError,
  payerError,
  refLabel,
  refPlaceholder,
  refHelpText,
  requiresAccountNumber,
  payerAccountLabel,
  submittingReceipt,
  clearErrors,
}: ReceiptSubmissionProps) {
  const [open, setOpen] = useState(false);

  const handleCancel = () => {
    setOpen(false);
    clearErrors();
  };

  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm font-medium transition-all hover:bg-primary/10"
      >
        <Shield className="h-4 w-4" />
        I've paid — verify now
      </button>

      <ReceiptDialog
        open={open}
        onOpenChange={setOpen}
        onCancel={handleCancel}
        onSubmit={onSubmit}
        receiptIdentifier={receiptIdentifier}
        setReceiptIdentifier={setReceiptIdentifier}
        payerAccount={payerAccount}
        setPayerAccount={setPayerAccount}
        receiptError={receiptError}
        payerError={payerError}
        refLabel={refLabel}
        refPlaceholder={refPlaceholder}
        refHelpText={refHelpText}
        fieldType="urlOrTransactionId"
        requiresAccountNumber={requiresAccountNumber}
        payerAccountLabel={payerAccountLabel}
        submittingReceipt={submittingReceipt}
      />
    </div>
  );
}
