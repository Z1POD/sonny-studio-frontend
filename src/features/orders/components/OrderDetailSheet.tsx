/**
 * src/features/orders/components/OrderDetailSheet.tsx
 *
 * Bottom sheet for full order detail: invoice, items, shipping, payment info,
 * receipt submission, live verification polling, and cancel.
 */

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ChevronDown, Truck, MapPin, Copy, CheckCircle2,
  Clock, Loader2, AlertCircle, ExternalLink, FileText,
  XCircle, Package,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { orderDetailQuery, orderKeys } from "../queries";
import { ordersApi } from "../api";
import type { OrderDetail, PaymentMethod } from "../api";
import { useConfirm } from "@/features/store/components/ConfirmModal";
import { BrandLoader } from "@/components/ui/loader";

//     Status helpers                                                             

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  printing: "Printing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const PAYMENT_LABELS: Record<string, string> = {
  pending: "Awaiting Payment",
  pending_verification: "Verifying Payment",
  paid: "Paid",
  failed: "Payment Failed",
};

function statusColor(status: string) {
  switch (status) {
    case "delivered": return "text-green-500";
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

//     Payment method card                                                       

function PaymentMethodCard({
  method,
  selected,
  onSelect,
}: {
  method: PaymentMethod;
  selected: boolean;
  onSelect: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyAccount = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(method.account_number).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-2xl border-2 p-4 transition ${
        selected ? "border-emerald-400/20 bg-primary/5" : "border-border bg-surface hover:border-border/60"
      }`}
    >
      <div className="flex items-center gap-3">
        {method.provider_logo && (
          <img
            src={method.provider_logo}
            alt={method.provider_name}
            className="h-8 w-8 rounded-lg object-contain"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{method.provider_name}</p>
          <p className="text-xs text-muted-foreground">{method.account_type}</p>
        </div>
        <div
          className={`h-4 w-4 rounded-full border-2 transition ${
            selected ? "border-primary bg-primary" : "border-border"
          }`}
        />
      </div>

      {selected && (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Account</p>
              <p className="font-mono text-sm">{method.account_number}</p>
            </div>
            <button
              onClick={copyAccount}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            >
              {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{method.reference.help_text}</p>
        </div>
      )}
    </button>
  );
}

//     Receipt submission form                                                    

function ReceiptForm({
  orderId,
  methods,
  onSuccess,
}: {
  orderId: string;
  methods: PaymentMethod[];
  onSuccess: (txRef: string) => void;
}) {
  const [provider, setProvider] = useState(methods[0]?.provider_code ?? "");
  const [receiptId, setReceiptId] = useState("");
  const [payerAccount, setPayerAccount] = useState("");

  const selectedMethod = methods.find((m) => m.provider_code === provider);

  const submitMutation = useMutation({
    mutationFn: () =>
      ordersApi.submitReceipt({
        order_id: orderId,
        provider,
        receipt_identifier: receiptId,
        payer_account: selectedMethod?.requires_payer_account ? payerAccount : undefined,
      }),
    onSuccess: (data) => {
      toast.success("Receipt submitted. Verifying payment…");
      onSuccess(data.transaction_id);
    },
    onError: (e: any) => {
      toast.error(e?.data?.error?.message ?? "Failed to submit receipt");
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">Select your bank</p>
      <div className="space-y-2">
        {methods.map((m) => (
          <PaymentMethodCard
            key={m.provider_code}
            method={m}
            selected={provider === m.provider_code}
            onSelect={() => setProvider(m.provider_code)}
          />
        ))}
      </div>

      {selectedMethod && (
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {selectedMethod.reference.label}
          </p>
          <Input
            placeholder={selectedMethod.reference.placeholder}
            value={receiptId}
            onChange={(e) => setReceiptId(e.target.value)}
            className="font-mono text-sm"
          />

          {selectedMethod.requires_payer_account && (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {selectedMethod.payer_account_label}
              </p>
              <Input
                placeholder="e.g., 12345678"
                value={payerAccount}
                onChange={(e) => setPayerAccount(e.target.value)}
                className="font-mono text-sm"
              />
            </>
          )}
        </div>
      )}

      <Button
        className="w-full"
        disabled={
          !receiptId ||
          (!!selectedMethod?.requires_payer_account && !payerAccount) ||
          submitMutation.isPending
        }
        onClick={() => submitMutation.mutate()}
      >
        {submitMutation.isPending ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</>
        ) : (
          "Submit Receipt"
        )}
      </Button>
    </div>
  );
}

//     Verification poller                                                       

function VerificationPoller({
  txRef,
  onVerified,
  onFailed,
}: {
  txRef: string;
  onVerified: () => void;
  onFailed: (msg: string) => void;
}) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [status, setStatus] = useState<"verifying" | "verified" | "failed">("verifying");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      try {
        const res = await ordersApi.verifyPayment(txRef);
        setStatus(res.status as any);
        if (res.is_verified) {
          clearInterval(intervalRef.current!);
          onVerified();
        } else if (res.status === "mismatch" || res.status === "failed") {
          clearInterval(intervalRef.current!);
          setErrorMsg(res.error_message);
          onFailed(res.error_message);
        }
      } catch {
        // keep polling
      }
    }, 4000);

    return () => clearInterval(intervalRef.current!);
  }, [txRef, onVerified, onFailed]);

  if (status === "verified") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
        <p className="font-medium text-green-600">Payment confirmed!</p>
        <p className="text-sm text-muted-foreground">Your order is now being processed.</p>
      </div>
    );
  }

  if (status === "failed" || status === "mismatch") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <XCircle className="h-10 w-10 text-destructive" />
        <p className="font-medium text-destructive">Verification failed</p>
        <p className="text-sm text-muted-foreground">{errorMsg || "Payment could not be verified."}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="font-medium">Verifying your payment…</p>
      <p className="text-sm text-muted-foreground">This usually takes 1–2 minutes. Don't close this page.</p>
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
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [txRef, setTxRef] = useState<string | null>(null);
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

  const handleInvoice = async () => {
    try {
      const inv = await ordersApi.invoice(orderId!);
      window.open(inv.invoice_url, "_blank");
    } catch {
      toast.error("Failed to load invoice");
    }
  };

  return (
    <>
      <AnimatePresence>
        {orderId && (
          <>
            <motion.div
              key="order-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={onClose}
            />

            <motion.div
              key="order-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 340 }}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl border-t border-border/60 bg-background shadow-2xl"
            >
              {/* Handle */}
              <div className="flex shrink-0 justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-border" />
              </div>

              {/* Title bar */}
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
                    paymentOpen={paymentOpen}
                    setPaymentOpen={setPaymentOpen}
                    txRef={txRef}
                    setTxRef={setTxRef}
                    onCancel={handleCancel}
                    onInvoice={handleInvoice}
                    cancelPending={cancelMutation.isPending}
                    onPaymentVerified={() => {
                      queryClient.invalidateQueries({ queryKey: orderKeys.all });
                    }}
                  />
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {ConfirmModal}
    </>
  );
}

//     Content                                                                   

function OrderDetailContent({
  order,
  section,
  setSection,
  paymentOpen,
  setPaymentOpen,
  txRef,
  setTxRef,
  onCancel,
  onInvoice,
  cancelPending,
  onPaymentVerified,
}: {
  order: OrderDetail;
  section: "items" | "shipping" | "timeline";
  setSection: (s: "items" | "shipping" | "timeline") => void;
  paymentOpen: boolean;
  setPaymentOpen: (v: boolean) => void;
  txRef: string | null;
  setTxRef: (v: string | null) => void;
  onCancel: () => void;
  onInvoice: () => void;
  cancelPending: boolean;
  onPaymentVerified: () => void;
}) {
  const sym = order.pricing.currency.symbol;
  const needsPayment =
    order.payment_status === "pending" || order.payment_status === "failed";
  const isVerifying = order.payment_status === "pending_verification";

  const paymentMethods =
    order.invoice?.payment?.methods ?? [];

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

      {/* Payment action */}
      {needsPayment && paymentMethods.length > 0 && order.status != 'cancelled'  && (
        <div className="rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-900/30 via-emerald-800/10 to-emerald-950/40 p-4    ">
          <div className="mb-3 flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-medium text-amber-600">Payment required</p>
              {/* <p className="mt-0.5 text-xs text-muted-foreground">
                {order.invoice?.payment?.instructions}
              </p> */}
              {order.invoice?.payment?.warning && (
                <p className="mt-1 text-xs font-medium text-emerald-600">
                  {order.invoice.payment.warning}
                </p>
              )}
            </div>
          </div>

          {/* Amount highlight */}
          <div className="mb-3 rounded-xl bg-emerald-500/10 px-4 py-2 text-center">
            <p className="text-xs text-muted-foreground">Amount to send</p>
            <p className="text-2xl font-bold text-emerald-100">
              {sym}{order.pricing.total}
            </p>
          </div>

          <button
            onClick={() => setPaymentOpen(!paymentOpen)}
            className="flex w-full items-center justify-between rounded-xl border border-amber-500/20 bg-background px-4 py-2.5 text-sm font-medium"
          >
            Submit payment receipt
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${paymentOpen ? "rotate-180" : ""}`}
            />
          </button>

          {paymentOpen && (
            <div className="mt-3">
              {txRef ? (
                <VerificationPoller
                  txRef={txRef}
                  onVerified={() => {
                    setTxRef(null);
                    setPaymentOpen(false);
                    onPaymentVerified();
                  }}
                  onFailed={() => setTxRef(null)}
                />
              ) : (
                <ReceiptForm
                  orderId={order.id}
                  methods={paymentMethods}
                  onSuccess={(ref) => setTxRef(ref)}
                />
              )}
            </div>
          )}
        </div>
      )}

      {isVerifying && (
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
        {/* <Button variant="outline" className="flex-1 gap-1.5 text-sm" onClick={onInvoice}>
          <FileText className="h-4 w-4" />
          Invoice
        </Button> */}
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