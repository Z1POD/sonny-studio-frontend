// src/features/checkout/components/payment/VerifyingState.tsx

import { motion } from "framer-motion";
import { Loader2, Clock, Wifi } from "lucide-react";

interface VerifyingStateProps {
  statusDisplay: string;
  transactionId?: string;
}

export function VerifyingState({ statusDisplay, transactionId }: VerifyingStateProps) {
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
        {statusDisplay}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground/60">
        Usually takes under a minute
      </p>

      {transactionId && (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5">
          <Wifi className="h-3 w-3 text-primary animate-pulse shrink-0" />
          <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[200px]">
            {transactionId}
          </span>
        </div>
      )}

      <p className="mt-5 text-[10px] text-muted-foreground/40">
        Don't close this screen
      </p>
    </motion.div>
  );
}