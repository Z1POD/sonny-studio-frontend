/**
 * src/features/store/components/DiscountSuggestionCard.tsx
 *
 * Adaptive "Suggested next step" card:
 *  1. No products        → "Spin up your first design"
 *  2. No published yet   → "Publish & share"
 *  3. Has published      → CTA opens DiscountOverlay
 *                           • mobile  → Sheet side="bottom"  (85dvh, drag handle)
 *                           • desktop → Dialog (centered modal, max-w-md)
 */

"use client";

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Tag, Plus, Copy, Check, Globe,
  Ticket, X, Loader2, Share2, Percent, DollarSign, Zap,
  Trash2, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import { discountApi, type DiscountRule, type DiscountType, type Coupon } from "../discountApi";
import { discountRulesQuery, couponsQuery, discountKeys } from "../discountQueries";
import { type ProductListItem } from "../api";
import { useShareDrawer } from "@/shared/components/ShareDrawer";
import { BrandLoader } from "@/components/ui/loader";

// ─── Small helpers ────────────────────────────────────────────────────────────

function useCopyToClipboard() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };
  return { copied, copy };
}

function DiscountTypeIcon({ type }: { type: DiscountType }) {
  if (type === "percentage") return <Percent className="h-3 w-3" />;
  if (type === "fixed_amount") return <DollarSign className="h-3 w-3" />;
  return <Zap className="h-3 w-3" />;
}

// ─── Create rule form ─────────────────────────────────────────────────────────

function CreateRuleForm({ onCreated }: { onCreated: (rule: DiscountRule) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<DiscountType>("percentage");
  const [value, setValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () =>
      discountApi.createRule({
        name,
        discount_type: type,
        value,
        scope: "item",
        max_uses: maxUses ? parseInt(maxUses) : undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: discountKeys.rules() });
      toast.success("Discount rule created!");
      onCreated(res.data);
      setName(""); setValue(""); setMaxUses("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to create discount"),
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (name.trim() && value) mut.mutate(); }}
      className="space-y-3"
    >
      <div>
        <Label className="text-xs text-muted-foreground">Rule name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Summer Sale 15% Off"
          className="mt-1 h-9 text-sm"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as DiscountType)}>
            <SelectTrigger className="mt-1 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage off</SelectItem>
              <SelectItem value="fixed_amount">Fixed amount off</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">
            {type === "percentage" ? "Value (%)" : type === "fixed_amount" ? "Amount" : "Value"}
          </Label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={type === "percentage" ? "15" : "50"}
            type="number" min="0" step="0.01"
            className="mt-1 h-9 text-sm"
            required
          />
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Max uses (optional)</Label>
        <Input
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
          placeholder="Unlimited"
          type="number" min="1"
          className="mt-1 h-9 text-sm"
        />
      </div>

      <Button
        type="submit"
        className="w-full rounded-full"
        disabled={mut.isPending || !name.trim() || !value}
      >
        {mut.isPending
          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          : <Tag className="mr-2 h-4 w-4" />}
        Create discount rule
      </Button>
    </form>
  );
}

// ─── Coupon row ───────────────────────────────────────────────────────────────

function CouponRow({ coupon }: { coupon: Coupon }) {
  const { copied, copy } = useCopyToClipboard();
  const qc = useQueryClient();

  const revoke = useMutation({
    mutationFn: () => discountApi.revokeCoupon(coupon.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: discountKeys.all });
      toast.success("Coupon revoked");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to revoke"),
  });

  const statusColor =
    coupon.status === "active" ? "text-green-500"
    : coupon.status === "used" ? "text-muted-foreground"
    : "text-red-400";

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <Ticket className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-mono text-xs font-medium">{coupon.code}</span>
        <span className={`shrink-0 text-[10px] font-medium ${statusColor}`}>
          {coupon.status_display}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1 ml-2">
        {coupon.status === "active" && (
          <>
            <button
              onClick={() => copy(coupon.code, coupon.id)}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-overlay transition"
              title="Copy code"
            >
              {copied === coupon.id
                ? <Check className="h-3 w-3 text-green-500" />
                : <Copy className="h-3 w-3" />}
            </button>
            <button
              onClick={() => revoke.mutate()}
              disabled={revoke.isPending}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-red-400 hover:bg-surface-overlay transition disabled:opacity-40"
              title="Revoke"
            >
              {revoke.isPending
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <X className="h-3 w-3" />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Rule accordion panel ─────────────────────────────────────────────────────

function RulePanel({
  rule,
  publishedProducts,
}: {
  rule: DiscountRule;
  publishedProducts: ProductListItem[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genCount, setGenCount] = useState("5");
  const [genPrefix, setGenPrefix] = useState("");
  const { copied, copy } = useCopyToClipboard();
  const qc = useQueryClient();

  const coupons = useQuery({ ...couponsQuery(rule.id), enabled: expanded });

  const apply = useMutation({
    mutationFn: (productId: string) =>
      discountApi.applyDiscountToProduct(productId, { discount_rule_id: rule.id }),
    onSuccess: () => {
      toast.success("Discount applied!");
      qc.invalidateQueries({ queryKey: discountKeys.all });
    },
    onError: (e: any) =>
      toast.error(e?.error?.message ?? e?.message ?? "Failed to apply"),
  });

  const generate = useMutation({
    mutationFn: () =>
      discountApi.generateCoupons(rule.id, {
        count: parseInt(genCount) || 1,
        prefix: genPrefix || undefined,
      }),
    onSuccess: (res) => {
      toast.success(`${res.data.generated} coupons generated!`);
      qc.invalidateQueries({ queryKey: discountKeys.coupons(rule.id) });
      setShowGenerate(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to generate"),
  });

  const deleteRule = useMutation({
    mutationFn: () => discountApi.deleteRule(rule.id),
    onSuccess: () => {
      toast.success("Discount rule deleted");
      qc.invalidateQueries({ queryKey: discountKeys.rules() });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const usageText =
    rule.max_uses != null
      ? `${rule.current_uses} / ${rule.max_uses} uses`
      : `${rule.current_uses} uses`;

  const activeCouponCount = coupons.data?.data.filter((c) => c.status === "active").length ?? 0;

  return (
    <div className="rounded-2xl border border-border bg-surface-overlay overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-surface transition"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <DiscountTypeIcon type={rule.discount_type} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold">{rule.name}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                rule.is_active
                  ? "bg-green-500/15 text-green-600"
                  : "bg-muted text-muted-foreground"
              }`}>
                {rule.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{rule.value_display}</span>
              <span>·</span>
              <span>{usageText}</span>
              {rule.coupon_count > 0 && (
                <><span>·</span><span>{rule.coupon_count} coupons</span></>
              )}
            </div>
          </div>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {/* Expanded body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border p-4 space-y-4">

              {/* Rule code */}
              <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Rule code</div>
                  <div className="font-mono text-sm font-medium">{rule.code}</div>
                </div>
                <button
                  onClick={() => copy(rule.code, `rule-${rule.id}`)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-overlay transition"
                >
                  {copied === `rule-${rule.id}`
                    ? <Check className="h-3.5 w-3.5 text-green-500" />
                    : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Apply to products */}
              {publishedProducts.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">Apply to product</div>
                  <div className="grid gap-2">
                    {publishedProducts.slice(0, 4).map((prod) => (
                      <div key={prod.id} className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {prod.thumbnail_url
                            ? <img src={prod.thumbnail_url} alt={prod.title} className="h-7 w-7 rounded-lg object-cover shrink-0" />
                            : <div className="h-7 w-7 rounded-lg bg-surface-overlay shrink-0" />}
                          <span className="truncate text-xs font-medium">{prod.title}</span>
                        </div>
                        <button
                          onClick={() => apply.mutate(prod.id)}
                          disabled={apply.isPending}
                          className="shrink-0 ml-2 rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50 flex items-center gap-1"
                        >
                          {apply.isPending
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : prod.product_discounts ? "Cancel" : "Apply"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coupons */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-medium text-muted-foreground">
                    Coupons{expanded && activeCouponCount > 0 ? ` (${activeCouponCount} active)` : ""}
                  </div>
                  <button
                    onClick={() => setShowGenerate((v) => !v)}
                    className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-surface transition"
                  >
                    <Plus className="h-3 w-3" /> Generate
                  </button>
                </div>

                <AnimatePresence>
                  {showGenerate && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mb-3"
                    >
                      <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Count (max 500)</Label>
                            <Input
                              value={genCount}
                              onChange={(e) => setGenCount(e.target.value)}
                              type="number" min="1" max="500"
                              className="mt-1 h-8 text-xs"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Prefix (optional)</Label>
                            <Input
                              value={genPrefix}
                              onChange={(e) => setGenPrefix(e.target.value.toUpperCase())}
                              placeholder="SUMMER"
                              className="mt-1 h-8 text-xs"
                            />
                          </div>
                        </div>
                        <Button
                          onClick={() => generate.mutate()}
                          disabled={generate.isPending}
                          size="sm"
                          className="w-full rounded-full h-8 text-xs"
                        >
                          {generate.isPending
                            ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                            : <Ticket className="mr-1.5 h-3 w-3" />}
                          Generate {genCount || "1"} coupon{parseInt(genCount) !== 1 ? "s" : ""}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {coupons.isLoading ? (
                  <div className="flex justify-center py-4">
                    <BrandLoader size="md" />
                  </div>
                ) : !coupons.data?.data.length ? (
                  <p className="text-xs text-muted-foreground py-2">
                    No coupons yet — generate some to share with your audience.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                    {coupons.data.data.map((coupon) => (
                      <CouponRow key={coupon.id} coupon={coupon} />
                    ))}
                  </div>
                )}
              </div>

              {/* Delete rule */}
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => {
                    if (window.confirm(`Delete "${rule.name}"? This cannot be undone.`)) {
                      deleteRule.mutate();
                    }
                  }}
                  disabled={deleteRule.isPending}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition disabled:opacity-40"
                >
                  {deleteRule.isPending
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Trash2 className="h-3 w-3" />}
                  Delete rule
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Shared drawer/modal body ─────────────────────────────────────────────────

function DiscountOverlayBody({ publishedProducts }: { publishedProducts: ProductListItem[] }) {
  const [showCreateRule, setShowCreateRule] = useState(false);
  const qc = useQueryClient();

  const rulesQuery = useQuery(discountRulesQuery());
  const rules = rulesQuery.data?.data ?? [];
  const hasRules = rules.length > 0;

  return (
    <ScrollArea className="flex-1 min-h-0 -mx-1 px-1">
      <div className="space-y-3 pb-8">

        {/* Rules list */}
        {rulesQuery.isLoading ? (
          <div className="space-y-2 pt-1">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-overlay" />
            ))}
          </div>
        ) : hasRules ? (
          <>
            <div className="flex items-center justify-between py-0.5">
              <p className="text-xs text-muted-foreground">
                {rules.length} rule{rules.length !== 1 ? "s" : ""} · tap to expand
              </p>
              <button
                onClick={() => qc.invalidateQueries({ queryKey: discountKeys.rules() })}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-overlay transition"
                title="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            {rules.map((rule) => (
              <RulePanel key={rule.id} rule={rule} publishedProducts={publishedProducts} />
            ))}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-surface-overlay/60 px-4 py-6 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Tag className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">No discount rules yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create a rule to generate coupon codes or apply discounts directly to products.
            </p>
          </div>
        )}

        {/* Create rule */}
        {showCreateRule ? (
          <div className="rounded-2xl border border-border bg-surface-overlay p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold">New discount rule</span>
              <button
                onClick={() => setShowCreateRule(false)}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-surface transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <CreateRuleForm onCreated={() => setShowCreateRule(false)} />
          </div>
        ) : (
          <Button
            variant={hasRules ? "outline" : "default"}
            className="w-full rounded-full"
            onClick={() => setShowCreateRule(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            {hasRules ? "New discount rule" : "Create your first discount"}
          </Button>
        )}
      </div>
    </ScrollArea>
  );
}

// ─── Responsive overlay: Sheet (mobile) ↔ Dialog (desktop) ───────────────────

function DiscountOverlay({
  open,
  onClose,
  publishedProducts,
}: {
  open: boolean;
  onClose: () => void;
  publishedProducts: ProductListItem[];
}) {
  const isMobile = useIsMobile();

  const TITLE = "Discounts & Coupons";
  const DESC  = "Create rules, generate coupon codes, and apply discounts to your products.";

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          side="bottom"
          className="h-[85dvh] rounded-t-3xl flex flex-col gap-3 px-4 pt-3 pb-0"
        >
          {/* Drag handle */}
          <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-border" />

          <SheetHeader className="shrink-0 text-left space-y-0.5 pb-1">
            <SheetTitle className="text-base">{TITLE}</SheetTitle>
            <SheetDescription className="text-xs">{DESC}</SheetDescription>
          </SheetHeader>

          <DiscountOverlayBody publishedProducts={publishedProducts} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md h-[85vh] flex flex-col gap-4 p-6">
        <DialogHeader className="shrink-0 space-y-0.5">
          <DialogTitle>{TITLE}</DialogTitle>
          <DialogDescription className="text-xs">{DESC}</DialogDescription>
        </DialogHeader>
        <DiscountOverlayBody publishedProducts={publishedProducts} />
      </DialogContent>
    </Dialog>
  );
}

// ─── Public: the suggestion card tile ────────────────────────────────────────

interface Props {
  products: ProductListItem[];
  productsLoading: boolean;
}

export function DiscountSuggestionCard({ products, productsLoading }: Props) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const { openShareDrawer } = useShareDrawer();

  const publishedProducts = products.filter(
    (p) => p.is_published || p.status === "published",
  );
  const hasAnyProduct = products.length > 0;
  const hasPublished  = publishedProducts.length > 0;

  // Loading
  if (productsLoading) {
    return (
      <div className="rounded-3xl border border-border bg-surface p-6 lg:col-span-2 animate-pulse">
        <div className="h-3 w-24 rounded bg-surface-overlay" />
        <div className="mt-3 h-5 w-48 rounded bg-surface-overlay" />
        <div className="mt-2 h-3 w-64 rounded bg-surface-overlay" />
        <div className="mt-5 h-9 w-32 rounded-full bg-surface-overlay" />
      </div>
    );
  }

  // Case 1 — no products at all
  if (!hasAnyProduct) {
    return (
      <div className="rounded-3xl border border-border bg-surface p-6 lg:col-span-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4" /> Suggested next step
        </div>
        <h3 className="mt-2 text-lg font-semibold tracking-tight">
          Spin up your first design in the Studio
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a blank from the catalog and start designing.
        </p>
        <Button asChild className="mt-4 rounded-full">
          <Link to="/studio">Open studio</Link>
        </Button>
      </div>
    );
  }

  // Case 2 — has drafts, none published
  if (!hasPublished) {
    const firstDraft = products[0];
    return (
      <div className="rounded-3xl border border-border bg-surface p-6 lg:col-span-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4" /> Suggested next step
        </div>
        <h3 className="mt-2 text-lg font-semibold tracking-tight">
          Publish your design and share it
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          You have {products.length} draft{products.length !== 1 ? "s" : ""} ready. Publish one
          to get your store link and share it with your community.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild className="rounded-full">
            <Link to="/store">
              <Globe className="mr-2 h-4 w-4" /> Publish a design
            </Link>
          </Button>
          {firstDraft?.public_link && (
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() =>
                openShareDrawer({
                  title: firstDraft.title,
                  url: firstDraft.public_link,
                  imageUrl: firstDraft.thumbnail_url,
                  productId: firstDraft.id,
                  shouldPublish: true,
                })
              }
            >
              <Share2 className="mr-2 h-4 w-4" /> Share to communities
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Case 3 — has published products → discount CTA
  return (
    <>
      <div className="rounded-3xl border border-border bg-surface p-6 lg:col-span-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4" /> Suggested next step
        </div>
        <h3 className="mt-2 text-lg font-semibold tracking-tight">
          Boost sales with discounts
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Create discount rules, generate shareable coupon codes, and attach them to your
          published products to attract more buyers.
        </p>
        <Button className="mt-4 rounded-full" onClick={() => setOverlayOpen(true)}>
          <Tag className="mr-2 h-4 w-4" /> Manage discounts
        </Button>
      </div>

      <DiscountOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        publishedProducts={publishedProducts}
      />
    </>
  );
}