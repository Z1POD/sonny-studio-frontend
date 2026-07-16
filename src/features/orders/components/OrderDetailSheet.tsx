// src/features/orders/components/OrderDetailSheet.tsx

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X, Truck, MapPin, CheckCircle2,
  Loader2, AlertCircle, ExternalLink,
  Package,
} from "lucide-react";
import { appToast as toast } from "@/lib/toaster";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { orderDetailQuery, orderKeys } from "../queries";
import { ordersApi } from "../api";
import type { OrderDetail } from "../api";
import { useConfirm } from "@/shared/components/ConfirmModal";
import { BrandLoader } from "@/components/ui/loader";

import { usePaymentVerification } from "@/features/payment/hooks/usePaymentVerification";
import { useClipboardCopy } from "@/features/payment/hooks/useClipboardCopy";
import {
  AmountBanner,
  BankSelector,
  ReceiptSubmission,
  VerifyingState,
  SuccessState,
  FailedState,
} from "@/features/payment/components";

//     Status helpers                                                             

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing...",
  printing: "Printing...",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function statusColor(status: string) {
  switch (status) {
    case "confirmed": return "text-emerald-500";
    case "delivered": return "text-blue-300";
    case "cancelled": return "text-destructive";
    case "shipped": return "text-blue-500";
    case "pending": return "text-muted-foreground";
    default: return "text-amber-500";
  }
}

//     Timeline step                                                             

function TimelineStep({
  label,
  date,
  done,
  active,
  last,
}: {
  label: string;
  date?: string | null;
  done: boolean;
  active: boolean;
  last?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition ${
            done
              ? "border-green-500 bg-green-500"
              : active
              ? "border-primary bg-primary/10"
              : "border-border bg-transparent"
          }`}
        >
          {done && <CheckCircle2 className="h-3 w-3 text-white" />}
          {active && !done && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
        </div>
        {!last && (
          <div
            className={`mt-1 w-0.5 flex-1 min-h-6 ${done ? "bg-green-500/40" : "bg-border"}`}
          />
        )}
      </div>
      <div className="pb-5">
        <p className={`text-sm font-medium ${done || active ? "" : "text-muted-foreground"}`}>
          {label}
        </p>
        {date && (
          <p className="text-xs text-muted-foreground">
            {new Date(date).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
    </div>
  );
}

//     Main sheet                                                                

export function OrderDetailSheet({
  orderId,
  onClose,
}: {
  orderId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [confirm, ConfirmModal] = useConfirm();
  const [section, setSection] = useState<"items" | "shipping" | "timeline">("items");

  const { data: order, isLoading } = useQuery({
    ...orderDetailQuery(orderId ?? ""),
    enabled: !!orderId,
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => ordersApi.cancel(orderId!, reason),
    onSuccess: () => {
      toast.success("Order cancelled");
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
    onError: (e: any) => toast.error(e?.data?.error?.message ?? "Cannot cancel this order"),
  });

  const handleCancel = async () => {
    const ok = await confirm({
      title: "Cancel this order?",
      description: "This cannot be undone. A refund will be processed if payment was already made.",
      confirmLabel: "Cancel Order",
      danger: true,
    });
    if (ok) cancelMutation.mutate("Changed my mind");
  };

  return (
    <>
      <Sheet open={!!orderId} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="bottom"
          className="inset-x-0 bottom-0 top-auto flex h-auto max-h-[92dvh] w-full flex-col gap-0 overflow-hidden rounded-t-3xl border-t border-border/60 bg-background p-0 shadow-2xl [&>button]:hidden sm:max-w-none"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>
              Order {order?.order_number ?? ""}
            </SheetTitle>
            <SheetDescription>
              View order details, payment status, and available actions.
            </SheetDescription>
          </SheetHeader>

          {/* Handle */}
          <div className="flex shrink-0 justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>

          {/* Visible title bar */}
          <div className="flex shrink-0 items-center justify-between px-5 pb-3">
            <div>
              <p className="text-xs text-muted-foreground">Order</p>
              <p className="font-semibold">{order?.order_number ?? "—"}</p>
            </div>

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 pb-8 no-scrollbar">
            {isLoading || !order ? (
              <div className="flex items-center justify-center py-20">
                <BrandLoader size="md" />
              </div>
            ) : (
              <OrderDetailContent
                order={order}
                section={section}
                setSection={setSection}
                onCancel={handleCancel}
                cancelPending={cancelMutation.isPending}
                onPaymentVerified={() => {
                  queryClient.invalidateQueries({ queryKey: orderKeys.all });
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {ConfirmModal}
    </>
  );
}

//     Content                                                                   

function OrderDetailContent({
  order,
  section,
  setSection,
  onCancel,
  cancelPending,
  onPaymentVerified,
}: {
  order: OrderDetail;
  section: "items" | "shipping" | "timeline";
  setSection: (s: "items" | "shipping" | "timeline") => void;
  onCancel: () => void;
  cancelPending: boolean;
  onPaymentVerified: () => void;
}) {
  const sym = order.pricing.currency.symbol;
  const needsPayment =
    (order.payment_status === "pending" || order.payment_status === "failed") &&
    order.status !== "cancelled";
  // True only when the order is stuck "verifying" from a previous session —
  // there's no stored transaction id to resume polling against, so this is
  // just an informational banner (matches the pre-refactor behavior).
  const isVerifyingFromPriorSession =
    order.payment_status === "pending_verification";

  const paymentMethods = order.invoice?.payment?.methods ?? [];

  const { copiedField, copy } = useClipboardCopy();
  const payment = usePaymentVerification({
    orderId: order.id,
    methods: paymentMethods,
    fallbackAmount: order.pricing.total,
    fallbackCurrency: order.pricing.currency.code,
    onVerified: onPaymentVerified,
  });

  const handleSubmitReceipt = async () => {
    try {
      await payment.submitReceipt();
    } catch (e: any) {
      toast.error(e?.data?.error?.message ?? e?.message ?? "Failed to submit receipt");
    }
  };

  const orderSteps = [
    { label: "Order placed", key: "created", date: order.timeline.created },
    { label: "Payment confirmed", key: "paid", date: order.timeline.paid },
    { label: "Shipped", key: "shipped", date: order.timeline.shipped },
    { label: "Delivered", key: "delivered", date: order.timeline.delivered },
  ];

  const stepIndex = orderSteps.findIndex((s) => !s.date);
  const activeStepIdx = stepIndex === -1 ? orderSteps.length - 1 : stepIndex - 1;

  return (
    <div className="space-y-5">
      {/* Status banner */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <p className={`text-sm font-semibold ${statusColor(order.status)}`}>
            {STATUS_LABELS[order.status] ?? order.status}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-sm font-semibold">
            {sym}{order.pricing.total}
          </p>
        </div>
      </div>

      {/* Payment action — same components/flow as checkout's payment step */}
      {needsPayment && paymentMethods.length > 0 && (
        <>
          {payment.verifyState &&
          !payment.verifyState.isTerminal &&
          (payment.verifyState.status === "submitted" || payment.verifyState.status === "verifying") ? (
            <VerifyingState
              statusDisplay={payment.verifyState.statusDisplay}
              transactionId={payment.verifyState.transactionId}
            />
          ) : payment.verifyState?.isVerified ? (
            <SuccessState
              orderNumber={order.order_number}
              primaryLabel="Done"
              onPrimary={() => setSection("timeline")}
            />
          ) : payment.verifyState?.isTerminal ? (
            <FailedState
              isMismatch={payment.verifyState.status === "mismatch"}
              errorMessage={payment.verifyState.errorMessage}
              onRetry={payment.retry}
              onCancel={onCancel}
              isCanceling={cancelPending}
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-amber-600">Payment required</p>
                </div>
              </div>

              <AmountBanner invoice={order.invoice} />

              <BankSelector
                methods={paymentMethods}
                selectedProviderCode={payment.selectedProviderCode}
                onSelect={payment.setSelectedProviderCode}
                onCopy={copy}
                copiedField={copiedField}
                sym={sym}
                total={order.pricing.total}
              />

              <ReceiptSubmission
                onSubmit={handleSubmitReceipt}
                receiptIdentifier={payment.receiptIdentifier}
                setReceiptIdentifier={payment.setReceiptIdentifier}
                payerAccount={payment.payerAccount}
                setPayerAccount={payment.setPayerAccount}
                receiptError={payment.receiptError}
                payerError={payment.payerError}
                refLabel={payment.selectedMethod?.referenceLabel ?? "Transaction ID / Receipt"}
                refPlaceholder={payment.selectedMethod?.referencePlaceholder ?? ""}
                refHelpText={payment.selectedMethod?.referenceHelpText ?? ""}
                requiresAccountNumber={payment.selectedMethod?.requiresPayerAccount ?? false}
                payerAccountLabel={
                  payment.selectedMethod?.payerAccountLabel ?? "Your account number (last 8 digits)"
                }
                submittingReceipt={payment.submittingReceipt}
                clearErrors={payment.clearErrors}
              />
            </div>
          )}
        </>
      )}

      {isVerifyingFromPriorSession && !payment.verifyState && (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <p className="text-sm">Verifying your payment…</p>
        </div>
      )}

      {/* Section tabs */}
      <div className="flex gap-1">
        {(["items", "shipping", "timeline"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`flex-1 rounded-full py-1.5 text-xs font-medium capitalize transition ${
              section === s
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Items */}
      {section === "items" && (
        <div className="space-y-3">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
            >
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                {item.mockup_url ? (
                  <img src={item.mockup_url} alt={item.product_name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Package className="h-5 w-5 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{item.product_name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.size} · {item.color_name} · ×{item.quantity}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {sym}{item.subtotal}
                </p>
              </div>
            </div>
          ))}

          {/* Pricing summary */}
          <div className="rounded-2xl border border-border bg-surface p-4 space-y-2">
            {[
              { label: "Subtotal", value: `${sym}${order.pricing.subtotal}` },
              { label: "Shipping", value: `${sym}${order.pricing.shipping_cost}` },
              ...(parseFloat(order.pricing.discount) > 0
                ? [{ label: "Discount", value: `-${sym}${order.pricing.discount}` }]
                : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span>{value}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 flex justify-between text-sm font-semibold">
              <span>Total</span>
              <span>{sym}{order.pricing.total}</span>
            </div>
          </div>
        </div>
      )}

      {/* Shipping */}
      {section === "shipping" && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              {order.shipping.delivery_type === "pickup" ? (
                <><MapPin className="h-4 w-4 text-primary" />Pickup</>
              ) : (
                <><Truck className="h-4 w-4 text-primary" />Delivery</>
              )}
            </div>

            {order.shipping.address && (
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p className="font-medium text-foreground">{order.shipping.address.full_name}</p>
                <p>{order.shipping.address.street}</p>
                <p>{order.shipping.address.city_name}, {order.shipping.address.country_name}</p>
                <p>{order.shipping.address.phone}</p>
              </div>
            )}

            {order.shipping.pickup_location && (
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p className="font-medium text-foreground">{order.shipping.pickup_location.name}</p>
                <p>{order.shipping.pickup_location.address}</p>
                {order.shipping.pickup_location.landmark && (
                  <p className="text-xs">{order.shipping.pickup_location.landmark}</p>
                )}
                <p className="mt-1 text-xs text-amber-600">{order.shipping.pickup_location.instructions}</p>
              </div>
            )}

            {order.shipping.vendor && (
              <p className="text-xs text-muted-foreground">
                {order.shipping.vendor}
                {order.shipping.service_level && ` · ${order.shipping.service_level}`}
              </p>
            )}
          </div>

          {order.tracking_number && (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Tracking</p>
              <div className="flex items-center justify-between">
                <p className="font-mono text-sm">{order.tracking_number}</p>
                {order.tracking_url && (
                  <a
                    href={order.tracking_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-primary"
                  >
                    Track <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {order.customer_note && (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Your note</p>
              <p className="text-sm">{order.customer_note}</p>
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      {section === "timeline" && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          {orderSteps.map((step, i) => (
            <TimelineStep
              key={step.key}
              label={step.label}
              date={step.date}
              done={!!step.date}
              active={i === activeStepIdx + 1}
              last={i === orderSteps.length - 1}
            />
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {order.can_cancel && (
          <Button
            variant="destructive"
            className="flex-1 text-sm"
            disabled={cancelPending}
            onClick={onCancel}
          >
            {cancelPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel Order"}
          </Button>
        )}
      </div>
    </div>
  );
}
