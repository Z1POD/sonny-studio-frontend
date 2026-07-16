// src/features/payment/components/SuccessState.tsx

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuccessStateProps {
  orderNumber?: string;
  /** Primary CTA, e.g. "Track order" (checkout) or "Done" (order-detail sheet). Omit to hide the button. */
  primaryLabel?: string;
  primaryIcon?: React.ReactNode;
  onPrimary?: () => void;
  /** Secondary CTA, e.g. "Continue shopping". Omit to hide the button. */
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export function SuccessState({
  orderNumber,
  primaryLabel,
  primaryIcon,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: SuccessStateProps) {
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

      <h3 className="mt-6 text-2xl font-bold tracking-tight">
        Payment confirmed!
      </h3>
      {orderNumber && (
        <p className="mt-2 text-sm text-muted-foreground">
          Order <span className="font-mono font-medium">{orderNumber}</span> is confirmed.
        </p>
      )}

      {(onPrimary || onSecondary) && (
        <div className="mt-6 flex flex-col gap-2 w-full max-w-xs">
          {onPrimary && (
            <Button
              onClick={onPrimary}
              className="w-full h-12 rounded-2xl text-base font-semibold"
            >
              {primaryIcon}
              {primaryLabel ?? "Continue"}
            </Button>
          )}

          {onSecondary && (
            <Button
              variant="ghost"
              onClick={onSecondary}
              className="w-full h-10 text-sm text-muted-foreground"
            >
              {secondaryLabel ?? "Close"}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}
