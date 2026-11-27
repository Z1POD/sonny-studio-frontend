// Small presentational pieces shared by the Dashboard, Earnings and Analytics screens.

"use client";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { SeriesPoint } from "../storeApi";

/** % change vs the previous equal period. `null` = that period had no activity → "—" (never 0). */
export function Delta({ value, suffix }: { value: number | null | undefined; suffix?: string }) {
  if (value === undefined) return null;
  if (value === null) return <span className="text-[11px] text-muted-foreground">— {suffix}</span>;
  const zero = value === 0;
  const pos = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${zero ? "text-muted-foreground" : pos ? "text-emerald-400" : "text-rose-400"}`}>
      {zero ? <Minus className="h-3 w-3" /> : pos ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}%{suffix ? <span className="ml-1 font-normal text-muted-foreground">{suffix}</span> : null}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  delta,
  deltaSuffix = "vs prev.",
  loading,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  /** undefined = hide the delta row; null = show "—". */
  delta?: number | null;
  deltaSuffix?: string;
  loading?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      {loading ? (
        <>
          <Skeleton className="h-7 w-24 rounded-lg" />
          <Skeleton className="h-3 w-14 rounded-full" />
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground tabular-nums">{sub}</p>}
          </div>
          {delta !== undefined && <Delta value={delta} suffix={deltaSuffix} />}
        </>
      )}
    </div>
  );
}

export function Section({ title, subtitle, action, children, className = "" }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-border bg-surface p-5 sm:p-6 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

//     Charts

export type SeriesMetric = "earnings" | "orders" | "views";
const valueOf = (p: SeriesPoint, m: SeriesMetric): number => (m === "earnings" ? parseFloat(p.earnings) || 0 : m === "orders" ? p.orders : p.views ?? 0);

/** Tiny line, no axes — the dashboard's 14-day trend. */
export function Sparkline({ series, metric = "earnings", className = "h-14 w-full" }: { series: SeriesPoint[]; metric?: SeriesMetric; className?: string }) {
  const d = useMemo(() => {
    if (series.length < 2) return null;
    const vals = series.map((p) => valueOf(p, metric));
    const max = Math.max(...vals, 1);
    const w = 200, h = 48, pad = 3;
    const pts = vals.map((v, i) => [pad + (i * (w - pad * 2)) / (vals.length - 1), h - pad - (v / max) * (h - pad * 2)] as const);
    const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    return { line, area: `${line} L${pts[pts.length - 1]![0]},${h} L${pts[0]![0]},${h} Z`, w, h };
  }, [series, metric]);
  if (!d) return <div className={className} />;
  return (
    <svg viewBox={`0 0 ${d.w} ${d.h}`} preserveAspectRatio="none" className={className} aria-hidden>
      <path d={d.area} fill="var(--color-primary, #C5A059)" opacity={0.15} />
      <path d={d.line} fill="none" stroke="var(--color-primary, #C5A059)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Full chart with a hover/tap readout and a metric switch (earnings / orders / views when present). */
export function SeriesChart({ series, loading, symbol, metrics = ["earnings", "orders"] }: { series: SeriesPoint[]; loading?: boolean; symbol: string; metrics?: SeriesMetric[] }) {
  const [metric, setMetric] = useState<SeriesMetric>(metrics[0]!);
  const [hover, setHover] = useState<number | null>(null);
  const g = useMemo(() => {
    if (!series.length) return null;
    const w = 800, h = 200, pad = 16;
    const vals = series.map((p) => valueOf(p, metric));
    const max = Math.max(...vals, 1);
    const xStep = (w - pad * 2) / Math.max(1, series.length - 1);
    const pts = series.map((p, i) => ({ x: pad + i * xStep, y: h - pad - (vals[i]! / max) * (h - pad * 2), v: vals[i]!, p }));
    const line = pts.map((q, i) => `${i ? "L" : "M"} ${q.x},${q.y}`).join(" ");
    const area = `M ${pts[0]!.x},${h - pad} ${pts.map((q) => `L ${q.x},${q.y}`).join(" ")} L ${pts[pts.length - 1]!.x},${h - pad} Z`;
    return { w, h, pts, line, area };
  }, [series, metric]);

  if (loading) return <Skeleton className="h-56 w-full rounded-2xl" />;
  if (!g) return <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">No data</div>;
  const fmt = (v: number) => (metric === "earnings" ? `${symbol} ${v.toFixed(2)}` : String(v));
  const hv = hover != null ? g.pts[hover] : null;
  const labels = series.filter((_, i) => i % Math.max(1, Math.floor(series.length / 5)) === 0 || i === series.length - 1);

  return (
    <div>
      {metrics.length > 1 && (
        <div className="mb-3 inline-flex rounded-full border border-border p-0.5">
          {metrics.map((m) => (
            <button key={m} onClick={() => setMetric(m)} className={`rounded-full px-3 py-1 text-[11px] font-medium capitalize transition ${metric === m ? "bg-foreground text-background" : "text-muted-foreground"}`}>
              {m}
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <svg viewBox={`0 0 ${g.w} ${g.h}`} preserveAspectRatio="none" className="h-52 w-full" onMouseLeave={() => setHover(null)} onTouchEnd={() => setHover(null)}>
          <defs>
            <linearGradient id="series-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary, #C5A059)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--color-primary, #C5A059)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={g.area} fill="url(#series-grad)" />
          <path d={g.line} fill="none" stroke="var(--color-primary, #C5A059)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {g.pts.map((q, i) => (
            <rect key={i} x={q.x - g.w / g.pts.length / 2} y={0} width={g.w / g.pts.length} height={g.h} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
          ))}
          {hv && <circle cx={hv.x} cy={hv.y} r={4} fill="var(--color-primary, #C5A059)" stroke="var(--background, #fff)" strokeWidth={2} />}
        </svg>
        {hv && (
          <div className="pointer-events-none absolute top-0 z-10 rounded-xl border border-border bg-surface/95 px-3 py-2 text-xs shadow-lg backdrop-blur" style={{ left: `clamp(0px, calc(${(hv.x / g.w) * 100}% - 50px), calc(100% - 120px))` }}>
            <p className="font-medium">{shortDate(hv.p.date)}</p>
            <p className="font-semibold text-primary">{fmt(hv.v)}</p>
            <p className="text-muted-foreground">{hv.p.orders} orders{hv.p.views != null ? ` · ${hv.p.views} views` : ""}</p>
          </div>
        )}
        <div className="mt-1 flex justify-between px-1">
          {labels.map((s) => <span key={s.date} className="text-[10px] text-muted-foreground">{shortDate(s.date)}</span>)}
        </div>
      </div>
    </div>
  );
}
