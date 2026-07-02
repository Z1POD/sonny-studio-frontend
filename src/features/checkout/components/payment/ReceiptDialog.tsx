// src/features/checkout/components/payment/ReceiptDialog.tsx

import { Shield, Upload, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
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
  fieldType: string;
  requiresAccountNumber: boolean;
  payerAccountLabel: string;
  submittingReceipt: boolean;
}

export function ReceiptDialog({
  open,
  onOpenChange,
  onCancel,
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
}: ReceiptDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) return;
        onOpenChange(o);
      }}
    >
      <DialogContent
        className="rounded-2xl sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Verify your payment
          </DialogTitle>
          <DialogDescription className="text-muted-foreground/60 text-left text-sm">
            Enter your receipt details below so we can confirm your payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {refLabel}
            </Label>
            <Input
              value={receiptIdentifier}
              onChange={(e) => setReceiptIdentifier(e.target.value)}
              maxLength={199}
              placeholder={refPlaceholder || "Enter transaction ID or receipt number"}
              className={`h-12 rounded-xl font-mono text-muted-foreground/40 text-sm mt-2 ${
                receiptError
                  ? "border-destructive focus-visible:ring-destructive"
                  : "border-border"
              } bg-background`}
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
            {receiptError ? (
              <p className="flex items-center gap-1 text-[11px] text-destructive">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {receiptError}
              </p>
            ) : refHelpText ? (
              <p className="text-[11px] text-muted-foreground/50">{refHelpText}</p>
            ) : null}
          </div>

          {requiresAccountNumber && (
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {payerAccountLabel}
              </Label>
              <Input
                value={payerAccount}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
                  setPayerAccount(digits);
                }}
                placeholder="e.g. 12345678"
                inputMode="numeric"
                maxLength={12}
                className={`h-12 rounded-xl font-mono text-muted-foreground/40 text-sm tracking-widest ${
                  payerError
                    ? "border-destructive focus-visible:ring-destructive"
                    : "border-border"
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
        </div>

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1 h-11 rounded-xl font-medium"
            disabled={submittingReceipt}
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={submittingReceipt || !receiptIdentifier.trim()}
            className="flex-1 h-11 rounded-xl font-semibold"
          >
            {submittingReceipt ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Submit receipt
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}