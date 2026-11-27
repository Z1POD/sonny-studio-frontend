// src/features/wallet/lib/wallet-format.tsx
//
// Formatting and label helpers shared across wallet components.

import { CreditCard, Smartphone, Globe, Bitcoin } from "lucide-react";
import { formatPrice } from "@/lib/format";

export function formatMoney(amount: string | number, currency: string | { symbol?: string; code?: string; decimal_places?: number } = "$"): string {
  return formatPrice(amount, currency);
}

export function txTypeLabel(type: string): string {
  const map: Record<string, string> = {
    escrow_fund: "Escrow funded",
    escrow_release: "Escrow released",
    escrow_settle: "Earnings settled",
    escrow_refund: "Escrow refunded",
    payout_reserve: "Payout reserved",
    payout_settle: "Payout sent",
    order_payment: "Order Payment",
    order_refund: "Order Refund",
    creator_earning: "Earning",
    creator_payout: "Payout",
    platform_fee: "Platform Fee",
    apparel_cost: "Product Cost",
    print_cost: "Print Cost",
    adjustment: "Adjustment",
    bonus: "Bonus",
    chargeback: "Chargeback",
  };
  return map[type] ?? type.replace(/_/g, " ");
}

export function txStatusColor(status: string): string {
  switch (status) {
    case "posted":
    case "completed": return "text-emerald-400";
    case "pending": return "text-amber-400";
    case "failed": return "text-red-400";
    case "reversed": return "text-muted-foreground";
    default: return "text-muted-foreground";
  }
}

export function withdrawalStatusColor(status: string): string {
  switch (status) {
    case "paid":
    case "completed": return "bg-emerald-500/10 text-emerald-400";
    case "requested":
    case "reserved":
    case "pending": return "bg-amber-500/10 text-amber-400";
    case "approved": return "bg-blue-500/10 text-blue-400";
    case "processing": return "bg-purple-500/10 text-purple-400";
    case "rejected": return "bg-red-500/10 text-red-400";
    case "failed": return "bg-red-500/10 text-red-400";
    case "cancelled": return "bg-border/40 text-muted-foreground";
    default: return "bg-border/40 text-muted-foreground";
  }
}

export const withdrawalStatusLabel = (s: string): string =>
  ({ requested: "Requested", reserved: "Funds reserved", approved: "Approved", paid: "Paid", rejected: "Rejected", cancelled: "Cancelled" } as Record<string, string>)[s] ?? s;

export const methodStatusLabel = (s: string): { label: string; cls: string } =>
  s === "active"
    ? { label: "Approved", cls: "bg-emerald-500/10 text-emerald-400" }
    : s === "pending"
    ? { label: "Pending approval", cls: "bg-amber-500/10 text-amber-400" }
    : { label: "Inactive", cls: "bg-red-500/10 text-red-400" };

export function categoryIcon(category: string) {
  switch (category) {
    case "bank":
    case "bank_transfer": return <CreditCard className="h-4 w-4" />;
    case "mobile_money": return <Smartphone className="h-4 w-4" />;
    case "digital_wallet": return <Globe className="h-4 w-4" />;
    case "crypto": return <Bitcoin className="h-4 w-4" />;
    default: return <CreditCard className="h-4 w-4" />;
  }
}