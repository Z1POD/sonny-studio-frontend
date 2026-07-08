// src/features/analytics/components/AnalyticsPage.tsx

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Eye,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Package,
  BarChart2,
  Clock,
  ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { analyticsSummaryQuery } from "../queries";
import type { AnalyticsRange, AnalyticsSummary, RevenueSeries } from "../api";

// Range selector

const RANGES: { id: AnalyticsRange; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];

// Helpers

function formatCurrency(value: number, symbol: string) {
  const format = (n: number) => parseFloat(n.toFixed(2));

  if (value >= 1_000_000) {
    return `${symbol} ${format(value / 1_000_000)}M`;
  }

  if (value >= 1_000) {
    return `${symbol} ${format(value / 1_000)}K`;
  }

  return `${symbol} ${format(value)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Delta badge

function Delta({ value }: { value: number | null | undefined }) {
  if (value == null) return null;
  const pos = value > 0;
  const zero = value === 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
        zero
          ? "text-muted-foreground"
          : pos
          ? "text-emerald-400"
          : "text-rose-400"
      }`}
    >
      {zero ? (
        <Minus className="h-3 w-3" />
      ) : pos ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

// KPI stat card

function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  loading,
  subValue, // Added optional subValue
}: {
  icon: React.ComponentType<any>; // Fixed to accept any Lucide icon type safely
  label: string;
  value: string;
  delta?: number | null;
  loading?: boolean;
  subValue?: string; // Type definition
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      {loading ? (
        <>
          <Skeleton className="h-7 w-24 rounded-lg" />
          <Skeleton className="h-3 w-12 rounded-full" />
        </>
      ) : (
        <>
          <div className="flex flex-row gap-2 items-baseline">
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
            {subValue && (
              <p className="text-xs text-muted-foreground tabular-nums">{subValue}</p>
            )}
          </div>
          {delta !== undefined && (
            <div className="flex items-center gap-1.5">
              <Delta value={delta} />
              <span className="text-[10px] text-muted-foreground">vs prev. period</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Revenue chart

function RevenueChart({ series, loading }: { series: RevenueSeries[]; loading: boolean }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const { points, path, area, w, h, pad } = useMemo(() => {
    if (!series.length) return { points: [], path: "", area: "", w: 800, h: 200, pad: 16 };
    const w = 800;
    const h = 200;
    const pad = 16;
    const max = Math.max(...series.map((s) => s.revenue));
    const min = Math.min(...series.map((s) => s.revenue));
    const range = Math.max(1, max - min);
    const xStep = (w - pad * 2) / Math.max(1, series.length - 1);
    const pts = series.map((s, i) => ({
      x: pad + i * xStep,
      y: h - pad - ((s.revenue - min) / range) * (h - pad * 2),
      ...s,
    }));
    const p = pts.map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`)).join(" ");
    const a =
      `M ${pts[0].x},${h - pad} ` +
      pts.map((p) => `L ${p.x},${p.y}`).join(" ") +
      ` L ${pts[pts.length - 1].x},${h - pad} Z`;
    return { points: pts, path: p, area: a, w, h, pad };
  }, [series]);

  if (loading) return <Skeleton className="h-52 w-full rounded-2xl" />;
  if (!series.length) return (
    <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">No data</div>
  );

  const hovPt = hovered !== null ? points[hovered] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-52 w-full"
        preserveAspectRatio="none"
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary, #C5A059)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-primary, #C5A059)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={area} fill="url(#rev-grad)" />

        {/* Line */}
        <path
          d={path}
          fill="none"
          stroke="var(--color-primary, #C5A059)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Invisible hit zones */}
        {points.map((pt, i) => (
          <rect
            key={i}
            x={pt.x - (w / points.length) / 2}
            y={0}
            width={w / points.length}
            height={h}
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
          />
        ))}

        {/* Hover dot */}
        {hovPt && (
          <circle
            cx={hovPt.x}
            cy={hovPt.y}
            r={4}
            fill="var(--color-primary, #C5A059)"
            stroke="var(--background, #fff)"
            strokeWidth={2}
          />
        )}
      </svg>

      {/* Tooltip */}
      <AnimatePresence>
        {hovPt && (
          <motion.div
            key={hovered}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute left-0 top-0 z-10 rounded-xl border border-border bg-surface/95 px-3 py-2 text-xs shadow-elevated backdrop-blur"
            style={{
              transform: `translateX(clamp(0px, ${(hovPt.x / w) * 100}% - 50px, calc(100% - 120px)))`,
            }}
          >
            <p className="font-medium">{formatDate(hovPt.date)}</p>
            <p className="text-muted-foreground">{hovPt.orders} orders</p>
            <p className="text-primary font-semibold">
              {hovPt.revenue}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* X-axis labels — show ~5 evenly spaced */}
      <div className="mt-1 flex justify-between px-1">
        {series
          .filter((_, i) => {
            const step = Math.max(1, Math.floor(series.length / 5));
            return i % step === 0 || i === series.length - 1;
          })
          .map((s) => (
            <span key={s.date} className="text-[10px] text-muted-foreground">
              {formatDate(s.date)}
            </span>
          ))}
      </div>
    </div>
  );
}

// Order status badge

const STATUS_STYLE: Record<string, string> = {
  pending:    "bg-amber-500/10 text-amber-400",
  confirmed:  "bg-blue-500/10 text-blue-400",
  processing: "bg-violet-500/10 text-violet-400",
  printing:   "bg-indigo-500/10 text-indigo-400",
  shipped:    "bg-sky-500/10 text-sky-400",
  delivered:  "bg-emerald-500/10 text-emerald-400",
  cancelled:  "bg-rose-500/10 text-rose-400",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
        STATUS_STYLE[status] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}

// Section shell

function Section({ title, subtitle, children, className = "" }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl border border-border bg-surface p-6 ${className}`}>
      <div className="mb-5">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// Main page

export function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const { data, isLoading } = useQuery(analyticsSummaryQuery(range));

  const sym = data?.currency?.symbol ?? "$";
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-8">

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sales, revenue and traffic at a glance.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-border bg-surface p-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                range === r.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </motion.header>

      {/* KPI grid */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4"
      >
        <StatCard
          icon={DollarSign}
          label="Revenue"
          value={data ? formatCurrency(data.total_earnings, sym) : "—"}
          delta={data?.total_earnings_delta}
          loading={isLoading}
        />
        
        <StatCard
          icon={ShoppingBag}
          label="Sales"
          value={data ? data.total_sales : "—"}
          delta={data?.total_sales_delta}
          loading={isLoading}
        />
        
        <StatCard
          icon={Package}
          label="Orders"
          value={data ? data.total_orders : "—"}
          delta={data?.total_orders_delta}
          loading={isLoading}
        />
        
        <StatCard
          icon={Eye}
          label="Views"
          value={data ? data.total_views : "—"}
          subValue={data ? `CVR: ${data.conversion_rate}%` : undefined}
          delta={data?.total_views_delta}
          loading={isLoading}
        />
      </motion.section>

      {/* Revenue chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="mt-4"
      >
        <Section
          title="Revenue over time"
          subtitle={data ? `${sym} ${data.total_earnings} · ${data.conversion_rate}% conversion` : undefined}
        >
          <RevenueChart series={data?.series ?? []} loading={isLoading} />
        </Section>
      </motion.div>

      {/* Middle row: top products + traffic */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="mt-4 grid gap-4 lg:grid-cols-3"
      >
        {/* Top products */}
        <Section title="Top products" subtitle="By revenue" className="lg:col-span-2">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {(data?.top_products ?? []).map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-xs text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="truncate font-medium">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-5 shrink-0 text-muted-foreground">
                    <span className="hidden sm:block">{p.sales} sales</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {formatCurrency(p.earnings, p.currency_symbol)}
                    </span>
                  </div>
                </div>
              ))}
              {!data?.top_products?.length && (
                <p className="py-6 text-center text-sm text-muted-foreground">No products sold yet.</p>
              )}
            </div>
          )}
        </Section>

        {/* Traffic sources */}
        <Section title="Traffic sources" subtitle="Where visitors come from">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-3.5">
              {(data?.traffic_sources ?? []).map((s) => (
                <div key={s.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="tabular-nums font-medium">{s.value}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${s.value}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="h-full rounded-full bg-primary"
                    />
                  </div>
                </div>
              ))}
              {!data?.traffic_sources?.length && (
                <p className="text-center text-sm text-muted-foreground">No data.</p>
              )}
            </div>
          )}
        </Section>
      </motion.div>

      {/* Bottom row: order status + recent orders */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="mt-4 grid gap-4 lg:grid-cols-3"
      >
        {/* Order status breakdown */}
        <Section title="Order status" subtitle="All orders this period" className="max-h-[50dvh] overflow-y-auto no-scrollbar">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {(data?.order_status_breakdown ?? []).map((s, index) => (
                <div key={`${s.status}-${index}`} className="flex items-center gap-3">
                  <StatusBadge status={s.status.toLowerCase()} />
                  <div className="flex flex-1 items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-elevated">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${s.percentage}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="h-full rounded-full bg-primary/60"
                      />
                    </div>
                    <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">
                      {s.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Recent orders */}
        <Section title="Recent orders" subtitle="Latest activity" className="lg:col-span-2 max-h-[50dvh] overflow-y-auto no-scrollbar">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {(data?.recent_orders ?? []).map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{o.product_name}</span>
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{o.order_number}</span>
                      <span>·</span>
                      <Clock className="h-3 w-3" />
                      <span>{formatRelative(o.created_at)}</span>
                    </div>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {o.currency_symbol} {parseFloat(o.earnings).toFixed(2)}
                  </span>
                </div>
              ))}
              {!data?.recent_orders?.length && (
                <p className="py-6 text-center text-sm text-muted-foreground">No recent orders.</p>
              )}
            </div>
          )}
        </Section>
      </motion.div>
    </div>
  );
}