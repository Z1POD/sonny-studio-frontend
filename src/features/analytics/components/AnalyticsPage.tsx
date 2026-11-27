// src/features/analytics/components/AnalyticsPage.tsx
//   GET /store/analytics/ — trends and attribution (earnings, orders, items sold, views, conversion, top products,
//   traffic sources). Order lists / status breakdowns live in the orders app, not here.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Coins, Eye, MousePointerClick, Package, ShoppingBag, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/format";
import { KpiCard, Section, SeriesChart } from "@/features/store/components/StatBits";
import { analyticsSummaryQuery } from "../queries";
import type { AnalyticsRange } from "../api";

const RANGES: { id: AnalyticsRange; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];

export function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const { data, isLoading, isError, error, refetch } = useQuery(analyticsSummaryQuery(range));

  const cur = data?.currency;
  const money = (v?: string) => (v == null ? "—" : formatPrice(v, cur));
  const t = data?.totals;
  const trafficTotal = (data?.traffic_sources ?? []).reduce((n, s) => n + s.value, 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-8">
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Trends and where your traffic comes from.</p>
        </div>
        <div className="inline-flex rounded-full border border-border bg-surface p-1">
          {RANGES.map((r) => (
            <button key={r.id} onClick={() => setRange(r.id)} className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${range === r.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
              {r.label}
            </button>
          ))}
        </div>
      </motion.header>

      {isError && (
        <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="text-destructive">{error instanceof Error ? error.message : "Couldn't load analytics."}</p>
          <button onClick={() => refetch()} className="mt-2 text-xs font-medium text-primary hover:underline">Try again</button>
        </div>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard icon={Coins} label="Earnings" value={money(t?.earnings)} delta={t?.earnings_delta} loading={isLoading} />
        <KpiCard icon={Package} label="Orders" value={t?.orders ?? "—"} delta={t?.orders_delta} loading={isLoading} />
        <KpiCard icon={ShoppingBag} label="Items sold" value={t?.items_sold ?? "—"} delta={t?.items_sold_delta} loading={isLoading} />
        <KpiCard icon={Eye} label="Views" value={t?.views ?? "—"} delta={t?.views_delta} loading={isLoading} />
        <KpiCard icon={MousePointerClick} label="Conversion" value={t?.conversion_rate != null ? `${t.conversion_rate}%` : "—"} delta={t?.conversion_rate_delta} loading={isLoading} />
        <KpiCard icon={Wallet} label="Avg / order" value={money(t?.avg_earnings_per_order)} delta={t?.avg_earnings_per_order_delta} loading={isLoading} />
      </section>

      <div className="mt-4">
        <Section title="Trend" subtitle="Switch between earnings, orders and views">
          <SeriesChart series={data?.series ?? []} loading={isLoading} symbol={cur?.symbol ?? ""} metrics={["earnings", "orders", "views"]} />
        </Section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Section title="Top products" subtitle="By earnings this period" className="lg:col-span-2">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
          ) : (data?.top_products ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No sales in this period yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data!.top_products.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 py-3 text-sm">
                  <span className="w-5 text-center text-xs text-muted-foreground">{i + 1}</span>
                  <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-overlay">
                    {p.thumbnail_url && <img src={p.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                  <span className="hidden text-muted-foreground sm:block">{p.sales} sold</span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatPrice(p.earnings, { symbol: p.currency_symbol })}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Traffic sources" subtitle="Top sources of product views">
          {isLoading ? (
            <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full rounded-lg" />)}</div>
          ) : (data?.traffic_sources ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No tracked visits yet.</p>
          ) : (
            <div className="space-y-3.5">
              {data!.traffic_sources.map((s) => {
                const pct = trafficTotal > 0 ? (s.value / trafficTotal) * 100 : 0;
                return (
                  <div key={s.label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className="font-medium tabular-nums">{s.value.toLocaleString()} <span className="text-muted-foreground">· {pct.toFixed(0)}%</span></span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: "easeOut" }} className="h-full rounded-full bg-primary" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </div>

      {data && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Lifetime: {money(data.lifetime.earnings)} earned · {data.lifetime.orders} orders · {data.lifetime.items_sold} items sold
        </p>
      )}
    </div>
  );
}
