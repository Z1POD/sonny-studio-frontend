// src/features/wallet/lib/wallet-format.tsx
//
// Formatting and label helpers shared across wallet components.

import { CreditCard, Smartphone, Globe, Bitcoin } from "lucide-react";

export function formatMoney(amount: string | number, symbol = "$"): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return `${symbol} ${n.toFixed(2)}`;
}

export function txTypeLabel(type: string): string {
  const map: Record<string, string> = {
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
    case "completed": return "text-emerald-400";
    case "pending": return "text-amber-400";
    case "failed": return "text-red-400";
    case "reversed": return "text-muted-foreground";
    default: return "text-muted-foreground";
  }
}

export function withdrawalStatusColor(status: string): string {
  switch (status) {
    case "completed": return "bg-emerald-500/10 text-emerald-400";
    case "pending": return "bg-amber-500/10 text-amber-400";
    case "approved": return "bg-blue-500/10 text-blue-400";
    case "processing": return "bg-purple-500/10 text-purple-400";
    case "rejected": return "bg-red-500/10 text-red-400";
    case "failed": return "bg-red-500/10 text-red-400";
    case "cancelled": return "bg-border/40 text-muted-foreground";
    default: return "bg-border/40 text-muted-foreground";
  }
}

export function categoryIcon(category: string) {
  switch (category) {
    case "bank_transfer": return <CreditCard className="h-4 w-4" />;
    case "mobile_money": return <Smartphone className="h-4 w-4" />;
    case "digital_wallet": return <Globe className="h-4 w-4" />;
    case "crypto": return <Bitcoin className="h-4 w-4" />;
    default: return <CreditCard className="h-4 w-4" />;
  }
}