// src/features/checkout/components/payment/FailedState.tsx

import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FailedStateProps {
  isMismatch: boolean;
  errorMessage?: string | null;
  onRetry: () => void;
  onCancel: () => void;
  isCanceling: boolean;
}

export function FailedState({
  isMismatch,
  errorMessage,
  onRetry,
  onCancel,
  isCanceling,
}: FailedStateProps) {
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
        {errorMessage ??
          "The receipt didn't match our records. Please try again."}
      </p>
      <div className="mt-6 flex flex-col gap-2 w-full max-w-xs">
        <Button
          onClick={onRetry}
          variant="outline"
          className="w-full h-11 rounded-xl font-medium"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
        <Button
          onClick={onCancel}
          variant="ghost"
          className="w-full h-10 text-sm text-destructive hover:text-destructive"
          disabled={isCanceling}
        >
          {isCanceling ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <X className="mr-2 h-4 w-4" />
          )}
          {isCanceling ? "Canceling..." : "Cancel order"}
        </Button>
      </div>
    </motion.div>
  );
}