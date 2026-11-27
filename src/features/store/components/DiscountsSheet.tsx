/**
 * src/features/store/components/DiscountsSheet.tsx
 *
 * Discounts & coupons manager. One responsive container (bottom sheet on phones, dialog on desktop)
 * with three views that slide in place, so there is never a sheet on a sheet:
 *   list    → every rule as a card (status, uses, reach) + quick-start templates when empty
 *   create  → type chips, one value field, live plain-language preview, "more options" folded away
 *   detail  → switch on/off, tabs: Products (toggle per product) · Coupons (generate/copy/revoke) · Activity (redemptions)
 */

"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Ban, Check, ChevronDown, Copy, Loader2, Percent, Plus, Search, Tag,
  Ticket, Trash2, Truck, Wallet, X, Zap,
} from "lucide-react";
import { appToast as toast } from "@/lib/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  discountApi,
  type Coupon,
  type CreateDiscountRulePayload,
  type DiscountRule,
  type DiscountScope,
  type DiscountType,
} from "../discountApi";
import { couponsQuery, discountKeys, discountRulesQuery, redemptionsQuery } from "../discountQueries";
import type { ProductListItem } from "../api";
import { storeProductKeys } from "../queries";

// ─── helpers ────────────────────────────────────────────────────────────────

const errMsg = (e: any, fallback: string) => {
  const m = e?.message;
  if (typeof m === "string" && m) return m;
  if (m && typeof m === "object") return Object.values(m).flat().join(" ") || fallback;
  return fallback;
};

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1600);
    });
  };
  return { copied, copy };
}

type RuleStatus = "active" | "paused" | "scheduled" | "ended" | "used_up";
function ruleStatus(r: DiscountRule): RuleStatus {
  const now = Date.now();
  if (!r.is_active) return "paused";
  if (r.ends_at && new Date(r.ends_at).getTime() < now) return "ended";
  if (r.starts_at && new Date(r.starts_at).getTime() > now) return "scheduled";
  if (r.max_uses != null && r.current_uses >= r.max_uses) return "used_up";
  return "active";
}
const STATUS_UI: Record<RuleStatus, { label: string; cls: string }> = {
  active: { label: "Live", cls: "bg-green-500/15 text-green-600" },
  paused: { label: "Paused", cls: "bg-muted text-muted-foreground" },
  scheduled: { label: "Scheduled", cls: "bg-blue-500/15 text-blue-600" },
  ended: { label: "Ended", cls: "bg-muted text-muted-foreground" },
  used_up: { label: "Used up", cls: "bg-amber-500/15 text-amber-600" },
};

const TYPE_UI: Record<DiscountType, { label: string; hint: string; icon: typeof Percent }> = {
  percentage: { label: "Percent off", hint: "e.g. 10% off", icon: Percent },
  fixed_amount: { label: "Amount off", hint: "e.g. 5 off", icon: Wallet },
  free_shipping: { label: "Free shipping", hint: "Delivery on you", icon: Truck },
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";

const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

function Badge({ status }: { status: RuleStatus }) {
  const s = STATUS_UI[status];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>{s.label}</span>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

// ─── list view ──────────────────────────────────────────────────────────────

const TEMPLATES: { title: string; sub: string; preset: Partial<FormState> }[] = [
  { title: "10% off everything", sub: "A simple welcome offer", preset: { type: "percentage", value: "10", name: "10% off" } },
  { title: "Free shipping", sub: "Remove the delivery worry", preset: { type: "free_shipping", value: "0", name: "Free shipping" } },
  { title: "First-order treat", sub: "20% off for new customers", preset: { type: "percentage", value: "20", name: "Welcome 20%", newOnly: true, more: true } },
];

function RuleCard({ rule, onOpen }: { rule: DiscountRule; onOpen: () => void }) {
  const st = ruleStatus(rule);
  const pct = rule.max_uses ? Math.min(100, (rule.current_uses / rule.max_uses) * 100) : 0;
  const Icon = TYPE_UI[rule.discount_type].icon;
  return (
    <button onClick={onOpen} className="w-full rounded-2xl border border-border bg-surface-overlay p-4 text-left transition active:scale-[0.99] hover:bg-surface">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{rule.name}</span>
            <Badge status={st} />
          </div>
          <p className="mt-0.5 text-lg font-semibold leading-tight tracking-tight">{rule.value_display}</p>
        </div>
      </div>
      {rule.max_uses != null && (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        {rule.current_uses}{rule.max_uses != null ? ` of ${rule.max_uses}` : ""} used · {rule.product_count} product{rule.product_count === 1 ? "" : "s"} · {rule.coupon_count} coupon{rule.coupon_count === 1 ? "" : "s"}
      </p>
    </button>
  );
}

function ListView({ onCreate, onOpen }: { onCreate: (preset?: Partial<FormState>) => void; onOpen: (id: string) => void }) {
  const { data, isLoading, isError, refetch } = useQuery(discountRulesQuery());
  const rules = data ?? [];
  return (
    <>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-4">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-overlay" />)}
        {isError && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="text-destructive">Couldn't load your discounts.</p>
            <button onClick={() => refetch()} className="mt-1 text-xs font-medium text-primary">Try again</button>
          </div>
        )}
        {!isLoading && !isError && rules.length === 0 && (
          <div className="space-y-3 pt-1">
            <div className="rounded-2xl border border-dashed border-border p-5 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><Tag className="h-5 w-5" /></span>
              <p className="mt-3 text-sm font-semibold">No discounts yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Start from an idea below or build your own.</p>
            </div>
            {TEMPLATES.map((t) => (
              <button key={t.title} onClick={() => onCreate(t.preset)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-overlay p-3.5 text-left hover:bg-surface">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Zap className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{t.title}</span><span className="block text-xs text-muted-foreground">{t.sub}</span></span>
                <Plus className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
        {rules.map((r) => <RuleCard key={r.id} rule={r} onOpen={() => onOpen(r.id)} />)}
      </div>
      <div className="shrink-0 border-t border-border bg-background py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button className="h-11 w-full rounded-full" onClick={() => onCreate()}><Plus className="mr-2 h-4 w-4" /> New discount</Button>
      </div>
    </>
  );
}

// ─── create view ────────────────────────────────────────────────────────────

interface FormState {
  type: DiscountType;
  value: string;
  name: string;
  scope: DiscountScope;
  more: boolean;
  maxUses: string;
  perUser: string;
  minOrder: string;
  maxDiscount: string;
  newOnly: boolean;
  starts: string;
  ends: string;
}
const EMPTY: FormState = {
  type: "percentage", value: "", name: "", scope: "order", more: false,
  maxUses: "", perUser: "", minOrder: "", maxDiscount: "", newOnly: false, starts: "", ends: "",
};

function summarize(f: FormState): string {
  const v = f.value.trim();
  let what = "Pick a discount type";
  if (f.type === "percentage") what = v ? `${v}% off` : "A percentage off";
  if (f.type === "fixed_amount") what = v ? `${v} off` : "A fixed amount off";
  if (f.type === "free_shipping") what = "Free shipping";
  const bits = [what];
  if (f.type !== "free_shipping") bits.push(f.scope === "item" ? "on each item" : "on the whole order");
  if (f.minOrder) bits.push(`orders over ${f.minOrder}`);
  if (f.newOnly) bits.push("new customers only");
  if (f.maxUses) bits.push(`first ${f.maxUses} uses`);
  if (f.ends) bits.push(`until ${fmtDate(toIso(f.ends))}`);
  return bits.join(" · ");
}

function CreateView({ preset, onDone }: { preset?: Partial<FormState>; onDone: (rule: DiscountRule) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<FormState>({ ...EMPTY, ...preset });
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const free = f.type === "free_shipping";
  const valueNum = parseFloat(f.value);
  const valueOk = free || (valueNum > 0 && (f.type !== "percentage" || valueNum <= 100));
  const canSave = f.name.trim().length > 0 && valueOk;

  const create = useMutation({
    mutationFn: () => {
      const payload: CreateDiscountRulePayload = {
        name: f.name.trim(),
        discount_type: f.type,
        value: free ? "0" : String(valueNum),
        scope: free ? "shipping" : f.scope,
      };
      if (f.maxUses) payload.max_uses = parseInt(f.maxUses);
      if (f.perUser) payload.max_uses_per_user = parseInt(f.perUser);
      if (f.minOrder) payload.min_order_amount = f.minOrder;
      if (f.maxDiscount && f.type === "percentage") payload.max_discount_amount = f.maxDiscount;
      if (f.newOnly) payload.new_customers_only = true;
      if (f.starts) payload.starts_at = toIso(f.starts);
      if (f.ends) payload.ends_at = toIso(f.ends);
      return discountApi.createRule(payload);
    },
    onSuccess: (rule) => {
      toast.success("Discount created");
      qc.invalidateQueries({ queryKey: discountKeys.rules() });
      onDone(rule);
    },
    onError: (e) => toast.error(errMsg(e, "Couldn't create the discount")),
  });

  return (
    <>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pb-4">
        <div>
          <p className="mb-2 text-xs font-medium">What kind of discount?</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(TYPE_UI) as DiscountType[]).map((t) => {
              const U = TYPE_UI[t]; const on = f.type === t;
              return (
                <button key={t} type="button" onClick={() => set("type", t)}
                  className={`flex flex-col items-center gap-1 rounded-2xl border p-3 text-center transition ${on ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface-overlay text-muted-foreground"}`}>
                  <U.icon className="h-4 w-4" />
                  <span className="text-xs font-semibold leading-tight">{U.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {!free && (
          <Field label={f.type === "percentage" ? "How much off? (%)" : "How much off?"} hint={f.type === "fixed_amount" ? "In your store currency." : undefined}>
            <div className="flex flex-wrap gap-2">
              {f.type === "percentage" && ["5", "10", "15", "20", "25"].map((p) => (
                <button key={p} type="button" onClick={() => set("value", p)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${f.value === p ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{p}%</button>
              ))}
            </div>
            <Input inputMode="decimal" placeholder={f.type === "percentage" ? "Custom, e.g. 12" : "e.g. 5"} value={f.value}
              onChange={(e) => set("value", e.target.value.replace(/[^0-9.]/g, ""))} className="h-11 rounded-xl text-base" />
            {f.type === "percentage" && valueNum > 100 && <span className="text-[11px] text-destructive">Can't be more than 100%.</span>}
          </Field>
        )}

        {!free && (
          <div>
            <p className="mb-2 text-xs font-medium">Applies to</p>
            <div className="grid grid-cols-2 gap-2">
              {([["order", "Whole order"], ["item", "Each item"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => set("scope", k)}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-medium ${f.scope === k ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface-overlay text-muted-foreground"}`}>{l}</button>
              ))}
            </div>
          </div>
        )}

        <Field label="Name" hint="Only you see this.">
          <Input placeholder="e.g. Summer launch" value={f.name} maxLength={80} onChange={(e) => set("name", e.target.value)} className="h-11 rounded-xl" />
        </Field>

        <div className="rounded-2xl border border-border">
          <button type="button" onClick={() => set("more", !f.more)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium">
            More options <ChevronDown className={`h-4 w-4 transition ${f.more ? "rotate-180" : ""}`} />
          </button>
          {f.more && (
            <div className="space-y-4 border-t border-border p-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Total uses"><Input inputMode="numeric" placeholder="Unlimited" value={f.maxUses} onChange={(e) => set("maxUses", e.target.value.replace(/\D/g, ""))} className="rounded-xl" /></Field>
                <Field label="Per customer"><Input inputMode="numeric" placeholder="Unlimited" value={f.perUser} onChange={(e) => set("perUser", e.target.value.replace(/\D/g, ""))} className="rounded-xl" /></Field>
                <Field label="Min. order"><Input inputMode="decimal" placeholder="None" value={f.minOrder} onChange={(e) => set("minOrder", e.target.value.replace(/[^0-9.]/g, ""))} className="rounded-xl" /></Field>
                {f.type === "percentage" && (
                  <Field label="Max. discount"><Input inputMode="decimal" placeholder="No cap" value={f.maxDiscount} onChange={(e) => set("maxDiscount", e.target.value.replace(/[^0-9.]/g, ""))} className="rounded-xl" /></Field>
                )}
                <Field label="Starts"><Input type="datetime-local" value={f.starts} onChange={(e) => set("starts", e.target.value)} className="rounded-xl" /></Field>
                <Field label="Ends"><Input type="datetime-local" value={f.ends} onChange={(e) => set("ends", e.target.value)} className="rounded-xl" /></Field>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-sm font-medium">New customers only</p><p className="text-[11px] text-muted-foreground">Buyers with no earlier order from you.</p></div>
                <Switch checked={f.newOnly} onCheckedChange={(v) => set("newOnly", v)} />
              </div>
            </div>
          )}
        </div>

        <p className="rounded-xl bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground"><span className="font-medium text-foreground">Preview: </span>{summarize(f)}</p>
      </div>
      <div className="shrink-0 border-t border-border bg-background py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button className="h-11 w-full rounded-full" disabled={!canSave || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Create discount
        </Button>
      </div>
    </>
  );
}

// ─── detail view ────────────────────────────────────────────────────────────

type Tab = "products" | "coupons" | "activity";

function ProductsTab({ rule, products }: { rule: DiscountRule; products: ProductListItem[] }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const toggle = useMutation({
    mutationFn: async ({ id, applied }: { id: string; applied: boolean }) => {
      if (applied) await discountApi.removeDiscountFromProduct(id, rule.id);
      else await discountApi.applyDiscountToProduct(id, { discount_rule_id: rule.id });
    },
    onSuccess: (_r, v) => {
      toast.success(v.applied ? "Removed from product" : "Applied to product");
      qc.invalidateQueries({ queryKey: discountKeys.all });
      qc.invalidateQueries({ queryKey: storeProductKeys.all });
    },
    onError: (e) => toast.error(errMsg(e, "Couldn't update the product")),
  });
  const shown = products.filter((p) => p.title.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="space-y-2">
      {products.length > 5 && (
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="h-10 rounded-xl pl-9" /></div>
      )}
      {shown.map((p) => {
        const applied = p.applied_discount_rule_ids?.includes(rule.id);
        const busy = toggle.isPending && toggle.variables?.id === p.id;
        return (
          <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface-overlay p-2.5">
            <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface">{p.thumbnail_url && <img src={p.thumbnail_url} alt="" className="h-full w-full object-cover" />}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.title}</span>
            {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Switch checked={!!applied} onCheckedChange={() => toggle.mutate({ id: p.id, applied: !!applied })} />}
          </div>
        );
      })}
      {shown.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{products.length ? "No products match." : "Publish a product first to attach this discount."}</p>}
    </div>
  );
}

function CouponsTab({ rule }: { rule: DiscountRule }) {
  const qc = useQueryClient();
  const { copied, copy } = useCopy();
  const [count, setCount] = useState(5);
  const [prefix, setPrefix] = useState("");
  const list = useQuery(couponsQuery(rule.id));
  const gen = useMutation({
    mutationFn: () => discountApi.generateCoupons(rule.id, { count, prefix: prefix.trim() || undefined }),
    onSuccess: (r) => {
      toast.success(`${r.generated} coupon${r.generated === 1 ? "" : "s"} ready`);
      qc.invalidateQueries({ queryKey: discountKeys.coupons(rule.id) });
      qc.invalidateQueries({ queryKey: discountKeys.rules() });
    },
    onError: (e) => toast.error(errMsg(e, "Couldn't generate coupons")),
  });
  const revoke = useMutation({
    mutationFn: (c: Coupon) => discountApi.revokeCoupon(c.id),
    onSuccess: () => { toast.success("Coupon revoked"); qc.invalidateQueries({ queryKey: discountKeys.coupons(rule.id) }); },
    onError: (e) => toast.error(errMsg(e, "Couldn't revoke")),
  });
  const coupons = list.data ?? [];
  const active = coupons.filter((c) => c.status === "active");

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-border p-3.5">
        <p className="text-sm font-semibold">Generate single-use codes</p>
        <div className="flex gap-2">
          {[1, 5, 10, 25, 50].map((n) => (
            <button key={n} onClick={() => setCount(n)} className={`flex-1 rounded-full border py-1.5 text-xs font-medium ${count === n ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{n}</button>
          ))}
        </div>
        <Input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))} placeholder="Prefix (optional), e.g. SUMMER" className="rounded-xl" />
        <Button className="w-full rounded-full" disabled={gen.isPending} onClick={() => gen.mutate()}>
          {gen.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ticket className="mr-2 h-4 w-4" />} Generate {count}
        </Button>
        <p className="text-[11px] text-muted-foreground">A buyer can use one coupon per order. Share the codes anywhere.</p>
      </div>

      {active.length > 1 && (
        <button className="text-xs font-medium text-primary" onClick={() => copy(active.map((c) => c.code).join("\n"), "__all")}>
          {copied === "__all" ? "Copied!" : `Copy all ${active.length} active codes`}
        </button>
      )}

      {list.isLoading ? <div className="h-16 animate-pulse rounded-xl bg-surface-overlay" /> : coupons.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No coupons yet.</p>
      ) : (
        <ul className="space-y-2">
          {coupons.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-xl border border-border bg-surface-overlay px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className={`truncate font-mono text-sm font-semibold ${c.status !== "active" ? "text-muted-foreground line-through" : ""}`}>{c.code}</p>
                <p className="text-[11px] text-muted-foreground">{c.status === "used" ? `Used${c.used_at ? ` ${fmtDate(c.used_at)}` : ""}` : c.status === "revoked" ? "Revoked" : "Ready to share"}</p>
              </div>
              {c.status === "active" && (
                <>
                  <button aria-label="Copy code" onClick={() => copy(c.code, c.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-surface">{copied === c.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}</button>
                  <button aria-label="Revoke coupon" disabled={revoke.isPending} onClick={() => revoke.mutate(c)} className="rounded-lg p-2 text-muted-foreground hover:bg-surface hover:text-destructive"><Ban className="h-4 w-4" /></button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityTab({ rule }: { rule: DiscountRule }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery(redemptionsQuery(rule.id, page));
  if (isLoading) return <div className="h-16 animate-pulse rounded-xl bg-surface-overlay" />;
  const rows = data?.results ?? [];
  if (rows.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No one has used this discount yet.</p>;
  const pages = Math.max(1, Math.ceil((data?.count ?? 0) / (data?.page_size || 20)));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface-overlay px-3 py-2.5 text-sm">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">#{r.order_number} · @{r.buyer_username}</p>
            <p className="truncate text-[11px] text-muted-foreground">{r.coupon_code ?? "Product link"} · {fmtDate(r.created_at)}</p>
          </div>
          <span className="shrink-0 font-semibold tabular-nums">−{r.amount}</span>
        </div>
      ))}
      {pages > 1 && (
        <div className="flex items-center justify-between pt-1 text-xs">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="font-medium text-primary disabled:opacity-40">Previous</button>
          <span className="text-muted-foreground">{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="font-medium text-primary disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

function DetailView({ ruleId, products, onGone }: { ruleId: string; products: ProductListItem[]; onGone: () => void }) {
  const qc = useQueryClient();
  const { copied, copy } = useCopy();
  const { data } = useQuery(discountRulesQuery());
  const rule = data?.find((r) => r.id === ruleId);
  const [tab, setTab] = useState<Tab>("products");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patch = useMutation({
    mutationFn: (is_active: boolean) => discountApi.updateRule(ruleId, { is_active }),
    onSuccess: (_r, v) => { toast.success(v ? "Discount is live" : "Discount paused"); qc.invalidateQueries({ queryKey: discountKeys.rules() }); },
    onError: (e) => toast.error(errMsg(e, "Couldn't update")),
  });
  const del = useMutation({
    mutationFn: () => discountApi.deleteRule(ruleId),
    onSuccess: () => { toast.success("Discount deleted"); qc.invalidateQueries({ queryKey: discountKeys.all }); qc.invalidateQueries({ queryKey: storeProductKeys.all }); onGone(); },
    onError: (e) => toast.error(errMsg(e, "Couldn't delete")),
  });

  if (!rule) return <div className="h-32 animate-pulse rounded-2xl bg-surface-overlay" />;
  const st = ruleStatus(rule);
  const TABS: { id: Tab; label: string; n?: number }[] = [
    { id: "products", label: "Products", n: rule.product_count },
    { id: "coupons", label: "Coupons", n: rule.coupon_count },
    { id: "activity", label: "Activity", n: rule.current_uses },
  ];
  const facts = [
    rule.max_uses != null && `${rule.current_uses}/${rule.max_uses} uses`,
    rule.max_uses_per_user != null && `${rule.max_uses_per_user} per customer`,
    rule.new_customers_only && "New customers",
    rule.starts_at && `From ${fmtDate(rule.starts_at)}`,
    rule.ends_at && `Until ${fmtDate(rule.ends_at)}`,
  ].filter(Boolean) as string[];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-3 pb-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-overlay p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><span className="truncate text-sm font-semibold">{rule.name}</span><Badge status={st} /></div>
            <p className="text-xl font-semibold tracking-tight">{rule.value_display}</p>
            {facts.length > 0 && <p className="mt-0.5 text-[11px] text-muted-foreground">{facts.join(" · ")}</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            <Switch checked={rule.is_active} disabled={patch.isPending} onCheckedChange={(v) => patch.mutate(v)} />
            <span className="text-[10px] text-muted-foreground">{rule.is_active ? "On" : "Off"}</span>
          </div>
        </div>
        {rule.code && (
          <button onClick={() => copy(rule.code, "code")} className="flex w-full items-center justify-between rounded-xl border border-dashed border-border px-3 py-2 text-left">
            <span><span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Rule code · used by product links</span><span className="font-mono text-sm font-semibold">{rule.code}</span></span>
            {copied === "code" ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
          </button>
        )}
        <div className="grid grid-cols-3 rounded-full bg-surface-overlay p-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-full py-1.5 text-xs font-medium transition ${tab === t.id ? "bg-foreground text-background" : "text-muted-foreground"}`}>
              {t.label}{t.n ? ` · ${t.n}` : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {tab === "products" && <ProductsTab rule={rule} products={products} />}
        {tab === "coupons" && <CouponsTab rule={rule} />}
        {tab === "activity" && <ActivityTab rule={rule} />}

        <div className="mt-6 border-t border-border pt-4">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <p className="flex-1 text-xs text-muted-foreground">Delete this discount and its coupons?</p>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => setConfirmDelete(false)}>Keep</Button>
              <Button size="sm" variant="destructive" className="rounded-full" disabled={del.isPending} onClick={() => del.mutate()}>{del.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete"}</Button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-xs font-medium text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete discount</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── shell ──────────────────────────────────────────────────────────────────

type View = { kind: "list" } | { kind: "create"; preset?: Partial<FormState> } | { kind: "detail"; id: string };

function Body({ products, onClose }: { products: ProductListItem[]; onClose: () => void }) {
  const [view, setView] = useState<View>({ kind: "list" });
  const title = view.kind === "list" ? "Discounts & coupons" : view.kind === "create" ? "New discount" : "Discount";
  const desc = view.kind === "list" ? "Offer a deal, share codes, see what's working." : view.kind === "create" ? "Choose the deal. You can attach it to products next." : "Manage where it applies and who used it.";
  const key = useMemo(() => (view.kind === "detail" ? `d-${view.id}` : view.kind), [view]);

  return {
    title, desc,
    back: view.kind === "list" ? null : () => setView({ kind: "list" }),
    node: (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={key} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.14 }} className="flex min-h-0 flex-1 flex-col">
          {view.kind === "list" && <ListView onCreate={(preset) => setView({ kind: "create", preset })} onOpen={(id) => setView({ kind: "detail", id })} />}
          {view.kind === "create" && <CreateView preset={view.preset} onDone={(r) => setView({ kind: "detail", id: r.id })} />}
          {view.kind === "detail" && <DetailView ruleId={view.id} products={products} onGone={() => setView({ kind: "list" })} />}
        </motion.div>
      </AnimatePresence>
    ),
  };
}

function Shell({ products, onClose, mobile }: { products: ProductListItem[]; onClose: () => void; mobile: boolean }) {
  const b = Body({ products, onClose });
  const head = (
    <div className="flex items-start gap-2">
      {b.back && <button onClick={b.back} aria-label="Back" className="-ml-1.5 mt-0.5 rounded-full p-1.5 hover:bg-surface-overlay"><ArrowLeft className="h-4 w-4" /></button>}
      <div className="min-w-0 flex-1 text-left">
        {mobile ? <SheetTitle className="text-base">{b.title}</SheetTitle> : <DialogTitle>{b.title}</DialogTitle>}
        {mobile ? <SheetDescription className="text-xs">{b.desc}</SheetDescription> : <DialogDescription className="text-xs">{b.desc}</DialogDescription>}
      </div>
    </div>
  );
  return (
    <>
      {mobile ? <SheetHeader className="shrink-0 space-y-0">{head}</SheetHeader> : <DialogHeader className="shrink-0 space-y-0">{head}</DialogHeader>}
      {b.node}
    </>
  );
}

export function DiscountsSheet({ open, onClose, publishedProducts }: { open: boolean; onClose: () => void; publishedProducts: ProductListItem[] }) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="bottom" className="flex h-[90dvh] flex-col gap-3 rounded-t-3xl px-4 pb-0 pt-3 [&>button]:hidden">
          <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-border" />
          {open && <Shell products={publishedProducts} onClose={onClose} mobile />}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex h-[85dvh] max-w-lg flex-col gap-4 p-6">
        {open && <Shell products={publishedProducts} onClose={onClose} mobile={false} />}
      </DialogContent>
    </Dialog>
  );
}
