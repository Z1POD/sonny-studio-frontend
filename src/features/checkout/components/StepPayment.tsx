// src/features/checkout/components/StepPayment.tsx
//
// Final checkout step. The order already exists (`pending_payment`); the shared PaymentPanel runs
// method → reference → receipt → verify. If the buyer leaves, the order stays payable from My Orders.

import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/shared/components/ConfirmModal";
import { appToast as toast } from "@/lib/toaster";
import { formatPrice } from "@/lib/format";
import { PaymentPanel } from "@/features/payment/components/PaymentPanel";
import { ordersApi } from "@/features/orders/api";
import { orderKeys } from "@/features/orders/queries";
import { useCheckoutStore } from "../store";

export function StepPayment() {
  const order = useCheckoutStore((s) => s.order);
  const reset = useCheckoutStore((s) => s.reset);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirm, confirmModal] = useConfirm();
  const [paid, setPaid] = useState(false); // verified or accepted for manual review

  const cancel = useMutation({
    mutationFn: (reason: string) => ordersApi.cancel(order!.id, reason),
    onSuccess: () => {
      toast.success("Order cancelled");
      qc.invalidateQueries({ queryKey: orderKeys.all });
      reset();
    },
    onError: (e: Error) => toast.error(e.message || "Could not cancel this order"),
  });

  if (!order) return null;

  const onDone = () => {
    setPaid(true);
    qc.invalidateQueries({ queryKey: orderKeys.all });
  };

  const handleCancel = async () => {
    const ok = await confirm({
      title: "Cancel this order?",
      description: "This cannot be undone.",
      confirmLabel: "Cancel order",
      danger: true,
    });
    if (ok) cancel.mutate("Cancelled from checkout");
  };

  const goOrders = () => {
    reset();
    navigate({ to: "/orders" });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="flex h-full flex-col"
      >
        <div className="flex-1 space-y-4 overflow-y-auto pb-6 no-scrollbar">
          <PaymentPanel
            orderId={order.id}
            orderNumber={order.orderNumber}
            amountLabel={formatPrice(order.total, order.currency)}
            onDone={onDone}
          />

          {paid ? (
            <div className="space-y-2">
              <Button className="h-12 w-full rounded-2xl" onClick={goOrders}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> View my orders
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => { reset(); navigate({ to: "/marketplace" }); }}>
                Continue shopping
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 pt-1">
              <button onClick={goOrders} className="text-xs text-muted-foreground hover:text-foreground">
                Pay later from My Orders
              </button>
              <button
                onClick={handleCancel}
                disabled={cancel.isPending}
                className="text-xs text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
              >
                {cancel.isPending ? "Cancelling order…" : "Cancel order"}
              </button>
            </div>
          )}
        </div>
      </motion.div>
      {confirmModal}
    </>
  );
}
