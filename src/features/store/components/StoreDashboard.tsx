// src/features/store/components/StoreDashboard.tsx

// Aligned to real API contract:
//  - pricing is { currency: {code,symbol,name}, base_price, markup_price, retail_price }
//  - Action buttons always visible (not hover-only) — mobile friendly
//  - Custom ConfirmModal replaces window.confirm
//  - "Suggested next step" is now adaptive via DiscountSuggestionCard
//  - ShareDrawer calls now include price, currencySymbol, and flags for Telegram Story

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight, ImageIcon, Shirt, Plus, Sparkles,
  Store as StoreIcon, Wallet as WalletIcon, BarChart3,
  Share2, Pencil, Check, Globe, Archive, Trash2,
  Loader2,
} from "lucide-react";
import { appToast as toast } from "@/lib/toaster";
import { Button } from "@/components/ui/button";
import {
  storeStatsQuery, storeSummaryQuery, walletQuery, storeProductsQuery, storeProductKeys,
} from "../queries";
import { storeProductApi, getRetailPrice, type ProductListItem } from "../api";
import { ProductListSheet } from "./ProductList";
import { EditProductModal } from "./EditProductModal";
import { useConfirm } from "../../../shared/components/ConfirmModal";
import { useShareDrawer } from "@/shared/components/ShareDrawer";
import { DiscountSuggestionCard } from "./DiscountSuggestionCard";

//     Stat tile                                                                 

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-5 py-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

//     Overlay action button (on thumbnail)                                      

function OverlayBtn({
  onClick, title, loading, children,
}: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white/80 backdrop-blur-sm transition hover:bg-black/60 disabled:opacity-40"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : children}
    </button>
  );
}

//     Product card                                                              

function ProductCard({
  p, onEdit, onMutated,
}: {
  p: ProductListItem;
  onEdit: (p: ProductListItem) => void;
  onMutated: () => void;
}) {
  const [confirm, ConfirmModal] = useConfirm();
  const { openShareDrawer } = useShareDrawer();

  const isDraft = !p.is_published && p.status !== "archived";
  const isPublished = p.is_published || p.status === "published";
  const isArchived = !p.is_published && p.status === "archived";

  const publishMutation = useMutation({
    mutationFn: () => storeProductApi.publish(p.id),
    onSuccess: () => { toast.success("Product published!"); onMutated(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to publish"),
  });

  const archiveMutation = useMutation({
    mutationFn: () => storeProductApi.archive(p.id),
    onSuccess: () => { toast.success("Product archived"); onMutated(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to archive"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => storeProductApi.deleteProduct(p.id),
    onSuccess: () => { toast.success("Product deleted"); onMutated(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!p.public_link) return;

    // Extract price and currency from product data
    const productData = p as any;
    const price = productData.pricing?.retail_price ?? productData.retail_price;
    const currencySymbol = productData.pricing?.currency?.symbol ?? productData.currency?.symbol;

    openShareDrawer({
      id: p.id,
      title: p.title,
      url: p.public_link,
      imageUrl: p.thumbnail_url,
      productId: p.id,
      shouldPublish: false,
      price,
      currencySymbol,
      flags: {
        isCustom: true,
        isPremium: productData.production_ready === true,
        isTrending: (productData.sold_quantity ?? 0) > 10,
        lowStock: productData.stock_quantity != null && productData.stock_quantity < 10,
      },
    });
  };

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: "Archive product?",
      description: "The product will be hidden from your store but not deleted.",
      confirmLabel: "Archive",
    });
    if (ok) archiveMutation.mutate();
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: "Delete product?",
      description: `"${p.title}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) deleteMutation.mutate();
  };

  return (
    <>
      <motion.div
        whileHover={{ y: -2 }}
        className="group relative overflow-hidden border border-border bg-surface text-left transition hover:border-border-strong sm:rounded-2xl lg:rounded-2xl"
      >
        <div className="relative aspect-square overflow-hidden bg-surface-overlay">
          {p.thumbnail_url ? (
            <img src={p.thumbnail_url} alt={p.title} className="h-full w-full object-cover transition group-hover:scale-105" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-8 w-8" />
            </div>
          )}

          {/* Status badge */}
          <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-medium backdrop-blur-sm ${
            isPublished ? "bg-green-500/80 text-white" : p.status === "archived" ? "bg-black/50 text-white/80" : "bg-amber-500/80 text-white"
          }`}>
            {isPublished ? "Published" : p.status === "archived" ? "Archived" : "Draft"}
          </span>

          {/* Action buttons */}
          <div className="absolute right-2 top-2 flex flex-col gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
            {isPublished && p.public_link && (
              <OverlayBtn onClick={handleShare} title="Share">
                <Share2 className="h-3 w-3" />
              </OverlayBtn>
            )}
            {isDraft && (
              <>
                <OverlayBtn
                  onClick={(e) => { e.stopPropagation(); publishMutation.mutate(); }}
                  title="Publish" loading={publishMutation.isPending}
                >
                  <Globe className="h-3 w-3" />
                </OverlayBtn>
                <OverlayBtn onClick={(e) => { e.stopPropagation(); onEdit(p); }} title="Edit">
                  <Pencil className="h-3 w-3" />
                </OverlayBtn>
              </>
            )}
            {isPublished && (
              <OverlayBtn onClick={handleArchive} title="Archive" loading={archiveMutation.isPending}>
                <Archive className="h-3 w-3" />
              </OverlayBtn>
            )}
            {isArchived && (
              <>
                <OverlayBtn
                  onClick={(e) => { e.stopPropagation(); publishMutation.mutate(); }}
                  title="Publish" loading={publishMutation.isPending}
                >
                  <Globe className="h-3 w-3" />
                </OverlayBtn>
                <OverlayBtn onClick={(e) => { e.stopPropagation(); onEdit(p); }} title="Edit">
                  <Pencil className="h-3 w-3" />
                </OverlayBtn>
                <OverlayBtn onClick={handleDelete} title="Delete" loading={deleteMutation.isPending}>
                  <Trash2 className="h-3 w-3" />
                </OverlayBtn>
              </>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="p-3">
          <div className="truncate text-sm font-medium">{p.title}</div>
          <div className="mt-0.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>{p.sold_quantity > 0 ? `${p.sold_quantity} sold` : "No sales yet"}</span>
            <span className="font-semibold text-foreground">{getRetailPrice(p)}</span>
          </div>
        </div>
      </motion.div>

      {ConfirmModal}
    </>
  );
}

//     StoreDashboard                                                            

export function StoreDashboard() {
  const summary = useQuery(storeSummaryQuery());
  const stats = useQuery(storeStatsQuery());
  const wallet = useQuery(walletQuery());
  const products = useQuery(storeProductsQuery({ page: 1, page_size: 8 }));
  // Dashboard grid only ever shows published products — filtered server-side
  const publishedProducts = useQuery(
    storeProductsQuery({ page: 1, page_size: 8, status: "published" }),
  );
  const qc = useQueryClient();

  const [editTarget, setEditTarget] = useState<ProductListItem | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: storeProductKeys.lists() });
    qc.invalidateQueries({ queryKey: ["store-stats"] });
    products.refetch();
    publishedProducts.refetch();
  };

  const productList = products.data?.results ?? [];
  const publishedList = publishedProducts.data?.results ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-2 pb-24 pt-6 sm:px-8">

      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface-elevated via-surface to-surface p-6 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="inline-flex h-11 w-16 sm:h-16 items-center justify-center overflow-hidden rounded-2xl bg-surface-overlay text-foreground/80 ring-1 ring-border-strong">
              {summary.data?.data?.logo_url
                ? <img src={summary.data.data.logo_url} alt="" className="h-full w-full object-cover" />
                : <StoreIcon className="h-7 w-7" />
              }
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {summary.data?.data?.name ?? "Your store"}
              </h1>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {summary.data?.data?.description ?? "Customize your storefront, publish designs and track sales."}
              </p>
            </div>
          </div>
          <Button asChild className="rounded-full">
            <Link to="/catalog"><Shirt className="mr-2 h-4 w-4" /> Browse catalog</Link>
          </Button>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Products" value={String(stats.data?.total_products ?? "—")} />
          <StatTile label="Sales" value={String(stats.data?.total_sales ?? "—")} />
          <StatTile label="Revenue" value={stats.data?.total_revenue != null ? `${wallet.data.data.currency.symbol} ${stats.data.total_revenue.toLocaleString()}` : "—"} />
          <StatTile label="Rating" value={stats.data?.rating != null ? stats.data.rating.toFixed(1) : "—"} />
        </div>
      </motion.section>

      {/* Wallet + Analytics + Suggested next step */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-1">
          {/* Wallet tile — unchanged */}
          <div className="rounded-3xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <WalletIcon className="h-4 w-4" /> Wallet
              </div>
              <Link to="/wallet" className="inline-flex items-center text-xs font-medium text-primary hover:underline">
                Details <ArrowUpRight className="ml-1 h-3 w-3" />
              </Link>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-semibold tracking-tight">
                {wallet.data?.data
                  ? `${wallet.data.data.currency.symbol} ${wallet.data.data.available}`
                  : "—"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Pending <span className="text-foreground">
                  {wallet.data?.data
                    ? `${wallet.data.data.currency.symbol}${wallet.data.data.pending}`
                    : "0.00"}
                </span>
              </div>
            </div>
          </div>

          {/* Analytics link — same pattern as the Wallet tile */}
          <Link
            to="/analytics"
            className="flex items-center justify-between rounded-3xl border border-border bg-surface p-6 transition hover:border-border-strong"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" /> Analytics
            </div>
            <span className="inline-flex items-center text-xs font-medium text-primary">
              View <ArrowUpRight className="ml-1 h-3 w-3" />
            </span>
          </Link>
        </div>

        {/* Dynamic suggestion card — adapts to user state */}
        <DiscountSuggestionCard
          products={productList}
          productsLoading={products.isLoading}
        />
      </section>

      {/* Products */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Products</h2>
          <ProductListSheet />
        </div>

        {publishedProducts.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-2xl bg-surface" />
            ))}
          </div>
        ) : publishedList.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-surface/60 p-10 text-center">
            <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-overlay text-muted-foreground">
              <Globe className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold">No published products yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Publish one of your designs or customize something new to start selling.
            </p>
            <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/designs"><Sparkles className="mr-2 h-4 w-4" /> Publish from designs</Link>
              </Button>
              <Button asChild className="rounded-full">
                <Link to="/catalog"><Plus className="mr-2 h-4 w-4" /> Customize new</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-0 sm:gap-3 sm:grid-cols-3 lg:grid-cols-4 rounded-2xl overflow-hidden">
            {publishedList.map((p) => (
              <ProductCard key={p.id} p={p} onEdit={setEditTarget} onMutated={refresh} />
            ))}
          </div>
        )}
      </section>

      {/* Edit modal */}
      <AnimatePresence>
        {editTarget && (
          <EditProductModal
            productId={editTarget.id}
            onClose={() => setEditTarget(null)}
            onSaved={() => { setEditTarget(null); refresh(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}