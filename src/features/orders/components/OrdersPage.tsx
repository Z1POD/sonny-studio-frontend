/**
 * src/features/orders/components/OrdersPage.tsx
 *
 * Lists all orders for the logged-in user. Filter by status via tabs.
 * Tap a card to open OrderDetailSheet.
 */

import { useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, ChevronRight, Clock, CheckCircle2, Truck,
  XCircle, Loader2, ShoppingBag, AlertCircle,
  CheckCheck,
  LoaderPinwheel,
  LoaderIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ordersInfiniteQuery } from "../queries";
import { ORDER_STATUS_LABEL, type OrderListItem, type OrderStatus } from "../api";
import { OrderDetailSheet } from "./OrderDetailSheet";
import { BrandLoader } from "@/components/ui/loader";

//     Status helpers                                                             

const STATUS_TABS: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Pending payment", value: "pending_payment" },
  { label: "Paid", value: "paid_verifying" },
  { label: "In production", value: "in_production" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

function statusIcon(status: OrderStatus) {
  switch (status) {
    case "pending_payment": return <Clock className="h-3.5 w-3.5" />;
    case "payment_processing":
    case "paid_verifying": return <LoaderIcon className="h-3.5 w-3.5" />;
    case "sent_to_printer": return <CheckCheck className="h-3.5 w-3.5" />;
    case "in_production": return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    case "handed_over": return <Truck className="h-3.5 w-3.5" />;
    case "delivered": return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "cancelled":
    case "payment_failed":
    case "refunded": return <XCircle className="h-3.5 w-3.5" />;
    default: return <Package className="h-3.5 w-3.5" />;
  }
}

function statusVariant(status: OrderStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "delivered": return "default";
    case "cancelled":
    case "payment_failed":
    case "fulfillment_exception":
    case "disputed": return "destructive";
    case "pending_payment": return "outline";
    default: return "secondary";
  }
}

const statusLabel = (status: OrderStatus): string => ORDER_STATUS_LABEL[status] ?? status;

function paymentBadge(paymentStatus: string) {
  if (paymentStatus === "paid") return null;
  if (paymentStatus === "pending_verification")
    return <span className="text-[10px] text-amber-500 font-medium">Verifying payment</span>;
  if (paymentStatus === "pending")
    return <span className="text-[10px] text-muted-foreground">Awaiting payment</span>;
  if (paymentStatus === "failed")
    return <span className="text-[10px] text-destructive font-medium">Payment failed</span>;
  return null;
}

//     Order card                                                                

function OrderCard({
  order,
  onClick,
}: {
  order: OrderListItem;
  onClick: () => void;
}) {
  const sym = order.currency_symbol + " ";

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition hover:border-border/80 hover:bg-surface/80 active:scale-[0.99]"
    >
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
        <Package className="h-6 w-6 text-muted-foreground/40" />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium">{order.order_number}</p>
          <Badge variant={statusVariant(order.status)} className="shrink-0 gap-1 text-[10px]">
            {statusIcon(order.status)}
            {statusLabel(order.status)}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {order.item_count} {order.item_count === 1 ? "item" : "items"}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-sm font-semibold">
            {sym}{order.total}
          </span>
          {paymentBadge(order.payment_status)}
        </div>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Placed{" "}
          {new Date(order.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
    </motion.button>
  );
}

//     Empty state                                                               

function EmptyOrders({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <ShoppingBag className="mb-4 h-10 w-10 text-muted-foreground/30" />
      <p className="text-sm font-medium text-muted-foreground">
        {filtered ? "No orders in this category" : "No orders yet"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground/60">
        {filtered
          ? "Try a different filter or check back later."
          : "Your orders will appear here once you place one."}
      </p>
    </div>
  );
}

//     Main component                                                            

export function OrdersPage() {
  const [activeTab, setActiveTab] = useState("");
  // `?order=<id>` (from notifications / profile) opens that order directly.
  const { order: orderParam } = useSearch({ strict: false }) as { order?: string };
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(orderParam ?? null);
  useEffect(() => { if (orderParam) setSelectedOrderId(orderParam); }, [orderParam]);

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, error } =
    useInfiniteQuery(
      ordersInfiniteQuery({ status: activeTab || undefined }),
    );

  const allOrders = data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/90 px-4 pb-0 pt-4 backdrop-blur">
        <h1 className="mb-3 text-xl font-semibold tracking-tight">My Orders</h1>

        {/* Status filter tabs */}
        <div className="flex gap-1 overflow-x-auto pb-3 scrollbar-none">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                activeTab === tab.value
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 no-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <BrandLoader size="md" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="mb-3 h-8 w-8 text-destructive/60" />
            <p className="text-sm text-muted-foreground">Failed to load orders</p>
          </div>
        ) : allOrders.length === 0 ? (
          <EmptyOrders filtered={!!activeTab} />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="flex flex-col gap-3">
              {allOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onClick={() => setSelectedOrderId(order.id)}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Load more */}
        {hasNextPage && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load more"
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Detail sheet */}
      <OrderDetailSheet
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
      />
    </div>
  );
}