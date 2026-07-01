// src/features/checkout/components/payment/SuccessState.tsx

import { motion } from "framer-motion";
import { Check, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCheckoutStore } from "../../store";

interface SuccessStateProps {
  orderNumber?: string;
}

export function SuccessState({ orderNumber }: SuccessStateProps) {
  const { reset } = useCheckoutStore();

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
      <p className="mt-2 text-sm text-muted-foreground">
        Order <span className="font-mono font-medium">{orderNumber}</span> is confirmed.
      </p>

      <div className="mt-6 flex flex-col gap-2 w-full max-w-xs">
        <Button
          onClick={() => {
            reset();
            window.location.href = "/orders";
          }}
          className="w-full h-12 rounded-2xl text-base font-semibold"
        >
          <FileCheck className="mr-2 h-4 w-4" />
          Track order
        </Button>
        <Button
          variant="ghost"
          onClick={reset}
          className="w-full h-10 text-sm text-muted-foreground"
        >
          Continue shopping
        </Button>
      </div>
    </motion.div>
  );
}