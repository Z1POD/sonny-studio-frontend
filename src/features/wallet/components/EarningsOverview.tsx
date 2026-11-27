// Earnings tab overview — GET /store/earnings/?range= : period earnings with deltas, the daily series, payout
// readiness (platform min/max) and the escrow clearance timeline (when pending money becomes withdrawable).

"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Coins, Package, ShoppingBag, Wallet as WalletIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/format";
import { storeEarningsQuery } from "@/features/store/queries";
import type { StatRange } from "@/features/store/storeApi";
import { KpiCard, Section, SeriesChart } from "@/features/store/components/StatBits";

const RANGES: { id: StatRange; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

export function EarningsOverview() {
  const [range, setRange] = useState<StatRange>("30d");
  const { data, isLoading, isError, error, refetch } = useQuery(storeEarningsQuery(range));
  const cur = data?.currency;
  const money = (v?: string | null) => (v == null ? "—" : formatPrice(v, cur));
  const p = data?.period;

  return (
    <section className="mt-8 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Earnings</h2>
        <div className="inline-flex rounded-full border border-border bg-surface p-1">
          {RANGES.map((r) => (
            <button key={r.id} onClick={() => setRange(r.id)} className={`rounded-full px-3 py-1 text-xs font-medium transition ${range === r.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="text-destructive">{error instanceof Error ? error.message : "Couldn't load earnings."}</p>
          <button onClick={() => refetch()} className="mt-2 text-xs font-medium text-primary hover:underline">Try again</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Coins} label="Earned" value={money(p?.earnings)} delta={p?.earnings_delta} loading={isLoading} />
        <KpiCard icon={Package} label="Orders" value={p?.orders ?? "—"} delta={p?.orders_delta} loading={isLoading} />
        <KpiCard icon={ShoppingBag} label="Items sold" value={p?.items_sold ?? "—"} delta={p?.items_sold_delta} loading={isLoading} />
        <KpiCard icon={WalletIcon} label="Avg / order" value={money(p?.avg_earnings_per_order)} delta={p?.avg_earnings_per_order_delta} loading={isLoading} />
      </div>

      <Section title="Daily earnings" subtitle={data ? `Platform commission paid so far: ${money(data.platform_fees_paid)}` : undefined}>
        <SeriesChart series={data?.series ?? []} loading={isLoading} symbol={cur?.symbol ?? ""} metrics={["earnings", "orders"]} />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Payout readiness" subtitle="Withdrawal limits come from the platform settings">
          {isLoading || !data ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : (
            <div className="space-y-3 text-sm">
              <div className={`flex items-start gap-2 rounded-xl p-3 ${data.payout.can_withdraw ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-600"}`}>
                {data.payout.can_withdraw ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <Clock className="mt-0.5 h-4 w-4 shrink-0" />}
                <p className="text-xs font-medium">
                  {data.payout.can_withdraw
                    ? `You can withdraw now — ${money(data.balances.available)} available.`
                    : data.payout.min_withdrawal
                    ? `Reach ${money(data.payout.min_withdrawal)} available to withdraw (you have ${money(data.balances.available)}).`
                    : "Nothing available to withdraw yet."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><p className="text-muted-foreground">Minimum</p><p className="mt-0.5 font-semibold">{data.payout.min_withdrawal ? money(data.payout.min_withdrawal) : "No minimum"}</p></div>
                <div><p className="text-muted-foreground">Maximum</p><p className="mt-0.5 font-semibold">{data.payout.max_withdrawal ? money(data.payout.max_withdrawal) : "No limit"}</p></div>
              </div>
              {data.payout.next_estimated_release_amount && (
                <p className="text-xs text-muted-foreground">
                  Next release: <b className="text-foreground">{money(data.payout.next_estimated_release_amount)}</b>
                  {data.payout.next_estimated_release_at ? ` around ${when(data.payout.next_estimated_release_at)}` : ""}
                </p>
              )}
            </div>
          )}
        </Section>

        <Section title="Clearing soon" subtitle="Released from escrow, becoming withdrawable">
          {isLoading ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : !data || data.pending_releases.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nothing waiting to clear.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.pending_releases.map((r) => (
                <li key={r.order_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.order_number}</p>
                    <p className="text-[11px] text-muted-foreground">Available {when(r.expected_available_at)}</p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{formatPrice(r.amount, { symbol: r.currency_symbol })}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </section>
  );
}
