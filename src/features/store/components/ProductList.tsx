// src/features/store/components/ProductList.tsx

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ImageIcon, Pencil, Share2, X, Loader2, Plus,
  ChevronDown, PackageOpen, Globe, Trash2, PackageX, Search, Clock,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { appToast as toast } from "@/lib/toaster";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { storeProductsInfiniteQuery, storeProductKeys } from "../queries";
import { storeProductApi, getRetailPrice, publishBlockerMessage, type ProductListItem } from "../api";
import { EditProductModal } from "./EditProductModal";
import { useConfirm } from "../../../shared/components/ConfirmModal";
import { useShareDrawer } from "@/shared/components/ShareDrawer";
import { BrandLoader } from "@/components/ui/loader";

// Status badge                                                              

function StatusBadge({ status, is_published }: { status: string; is_published: boolean }) {
  const published = is_published || status === "published";
  const archived = status === "archived";
  const pending = status === "pending_review";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
      published ? "bg-green-500/10 text-green-600 dark:text-green-400"
      : pending ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
      : archived ? "bg-border/60 text-muted-foreground"
      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
    }`}>
      {pending && <Clock className="h-2.5 w-2.5" />}
      {published ? "Published" : pending ? "In review" : archived ? "Archived" : "Draft"}
    </span>
  );
}

/** Shown when the product is not yet marked production-ready */
function NotReadyBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
      <PackageX className="h-2.5 w-2.5" />
      Not production ready
    </span>
  );
}

// Row action button                                                         

function ActionBtn({
  onClick, title, loading, danger, children,
}: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  loading?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded-lg border border-border/50 bg-surface/80 transition disabled:opacity-40 ${
        danger
          ? "text-muted-foreground hover:border-red-500/60 hover:text-red-500"
          : "text-muted-foreground hover:border-primary/60 hover:text-primary"
      }`}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : children}
    </button>
  );
}

// Product row                                                               

function ProductRow({
  product, onEdit, onMutated,
}: {
  product: ProductListItem;
  onEdit: (p: ProductListItem) => void;
  onMutated: () => void;
}) {
  const [confirm, ConfirmModal] = useConfirm();
  const { openShareDrawer } = useShareDrawer();
  const isPending = product.status === "pending_review";
  const isDraft = !product.is_published && product.status !== "archived" && !isPending;
  const isPublished = product.is_published || product.status === "published";
  const isProductionReady = product.production_ready;

  const publishMutation = useMutation({
    mutationFn: () => storeProductApi.publish(product.id),
    onSuccess: (r) => {
      // Publishing now goes through moderation: the listing only goes live once staff approve it.
      toast.success(r.is_published ? "Product published!" : "Submitted for review — we'll notify you when it's approved");
      onMutated();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to publish"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => storeProductApi.deleteProduct(product.id),
    onSuccess: () => { toast.success("Product deleted"); onMutated(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product.public_link) return;


    openShareDrawer({
      title: product.title,
      slug: product.slug,
      url: product.public_link,
      imageUrl: product.thumbnail_url ?? undefined,
      productId: product.id,
      shouldPublish: false,
      priceLabel: getRetailPrice(product),
      flags: {
        isCustom: true,
        isPremium: product.production_ready,
        isTrending: product.sold_quantity > 10,
      },
    });
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: "Delete product?",
      description: `"${product.title}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) deleteMutation.mutate();
  };

  const handlePublish = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Not publishable yet (e.g. no markup): send the creator to the review modal instead of a doomed request.
    const blocked = publishBlockerMessage(product);
    if (blocked) {
      toast.info(blocked);
      onEdit(product);
      return;
    }
    const p = product;
    const ok = await confirm({
      title: "Submit for review?",
      description:
        "Our team reviews every design before it goes live in the marketplace. Make sure the mockup, name, description, and colors/variants all look right.",
      confirmLabel: "Submit",
      preview: {
        imageUrl: product.thumbnail_url ?? undefined,
        title: product.title,
        subtitle: getRetailPrice(product),
        details: [
          ...(p.description ? [{ label: "Description", value: p.description }] : []),
          { label: "Blank", value: p.blank.name },
        ],
      },
    });
    if (ok) publishMutation.mutate();
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="flex flex-col gap-2 rounded-2xl border border-border/50 bg-surface p-3 transition hover:border-border"
      >
        <div className="flex items-center gap-3">
          {/* Thumbnail */}
          <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-surface-overlay">
            {product.thumbnail_url ? (
              <img src={product.thumbnail_url} alt={product.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground/40">
                <ImageIcon className="h-5 w-5" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="truncate text-sm font-medium">{product.title}</p>
              <StatusBadge status={product.status} is_published={product.is_published} />
              {product.is_private && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Share link only</span>}
              {/* Show "Not production ready" tag only for draft products that aren't ready */}
              {isDraft && !isProductionReady && <NotReadyBadge />}
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">{getRetailPrice(product)}</span>
              {product.sold_quantity > 0 && <span>{product.sold_quantity} sold</span>}
              <span>{new Date(product.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-shrink-0 items-center gap-1.5">
            {!isPublished && !isPending && (
              <ActionBtn onClick={(e) => { e.stopPropagation(); onEdit(product); }} title="Edit">
                <Pencil className="h-3.5 w-3.5" />
              </ActionBtn>
            )}
            {isPublished && (
              <ActionBtn onClick={handleShare} title="Share">
                <Share2 className="h-3.5 w-3.5" />
              </ActionBtn>
            )}
            {!isPublished && !isPending && (
              <ActionBtn onClick={handleDelete} title="Delete" loading={deleteMutation.isPending} danger>
                <Trash2 className="h-3.5 w-3.5" />
              </ActionBtn>
            )}
          </div>
        </div>

        {isPending && (
          <p className="rounded-lg bg-sky-500/5 px-3 py-2 text-[11px] text-sky-700 dark:text-sky-400">
            Waiting for staff review. It goes live as soon as it's approved; you'll get a notification either way.
          </p>
        )}

        {/* Publish — full width, brand-colored, only for drafts */}
        {isDraft && (
          <div className="flex justify-end">
            <button
              onClick={handlePublish}
              disabled={publishMutation.isPending}
              className="flex w-50 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#054236] via-[#0a6b57] to-[#054236] py-2.5 text-xs font-semibold text-white shadow-[0_0_16px_rgba(5,66,54,0.5)] transition hover:shadow-[0_0_24px_rgba(5,66,54,0.7)] disabled:opacity-50"
            >
              {publishMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Globe className="h-3.5 w-3.5" />
              )}
              Submit for review
            </button>
          </div>
        )}
      </motion.div>

      {ConfirmModal}
    </>
  );
}

// Filters                                                          

type StatusFilter = "all" | "draft" | "pending_review" | "published" | "archived";
const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "pending_review", label: "In review" },
  { id: "published", label: "Published" },
  { id: "archived", label: "Archived" },
];
const statusOf = (p: ProductListItem): StatusFilter =>
  p.status === "archived" ? "archived" : p.status === "pending_review" ? "pending_review" : p.is_published || p.status === "published" ? "published" : "draft";

// ProductList                                                          

export function ProductList({ onClose }: { onClose: () => void }) {
  const [editTarget, setEditTarget] = useState<ProductListItem | null>(null);
  const qc = useQueryClient();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery(storeProductsInfiniteQuery(20));

  const allProducts = data?.pages.flatMap((p) => p.results) ?? [];
  const total = data?.pages[0]?.count ?? 0;

  // Search + status filter run in the app over the loaded list (no extra API calls).
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const filtering = query.trim() !== "" || statusFilter !== "all";
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allProducts.filter((p) => {
      if (statusFilter !== "all" && statusOf(p) !== statusFilter) return false;
      if (!q) return true;
      return [p.title, p.description, p.blank?.name, p.slug].some((t) => (t ?? "").toLowerCase().includes(q));
    });
  }, [allProducts, query, statusFilter]);
  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: allProducts.length, draft: 0, pending_review: 0, published: 0, archived: 0 };
    for (const p of allProducts) c[statusOf(p)]++;
    return c;
  }, [allProducts]);

  // While filtering, pull in the remaining pages so the filter covers every product.
  useEffect(() => {
    if (filtering && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [filtering, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: storeProductKeys.lists() });
  }, [qc]);

  const handleEdited = useCallback(() => {
    setEditTarget(null);
    refresh();
  }, [refresh]);

  return (
    <>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">All Products</h2>
            {total > 0 && <p className="text-xs text-muted-foreground">{filtering ? `${visible.length} of ${total}` : `${total} total`}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="h-8 rounded-full text-xs">
              <Link to="/catalog">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New
              </Link>
            </Button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border/50 text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search + filters */}
        {allProducts.length > 0 && (
          <div className="space-y-2.5 border-b border-border/40 px-5 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your products"
                aria-label="Search products"
                className="h-9 w-full rounded-full border border-border/60 bg-surface-elevated/40 pl-9 pr-9 text-sm outline-none focus:border-primary/60"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${
                    statusFilter === f.id ? "border-primary bg-primary text-primary-foreground" : "border-border/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                  <span className="ml-1 opacity-70">{counts[f.id]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 no-scrollbar">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <BrandLoader size="md" />
            </div>
          ) : allProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-overlay text-muted-foreground">
                <PackageOpen className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">No products yet</p>
              <p className="text-xs text-muted-foreground">Create your first design in the Studio.</p>
              <Button asChild size="sm" className="mt-1 rounded-full">
                <Link to="/studio">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Create design
                </Link>
              </Button>
            </div>
          ) : visible.length === 0 && !hasNextPage ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <p className="text-sm font-medium">No matching products</p>
              <p className="text-xs text-muted-foreground">Try a different search or filter.</p>
              <Button variant="outline" size="sm" className="mt-1 rounded-full text-xs" onClick={() => { setQuery(""); setStatusFilter("all"); }}>
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {visible.map((p) => (
                  <ProductRow key={p.id} product={p} onEdit={setEditTarget} onMutated={refresh} />
                ))}
              </AnimatePresence>

              {hasNextPage && !filtering && (
                <div className="flex justify-center pt-3">
                  <Button
                    variant="outline" size="sm" className="rounded-full text-xs"
                    onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage
                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Loading…</>
                      : <><ChevronDown className="mr-2 h-3 w-3" /> Load more</>
                    }
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {editTarget && (
          <EditProductModal
            productId={editTarget.id}
            onClose={() => setEditTarget(null)}
            onSaved={handleEdited}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// Sheet / modal                                                            

export function ProductListModal({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[90dvh] gap-0 overflow-hidden rounded-t-3xl border border-border/60 bg-surface p-0 shadow-2xl [&>button]:hidden md:inset-x-auto md:left-1/2 md:bottom-auto md:top-1/2 md:h-[80dvh] md:w-[680px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>All Products</SheetTitle>
          <SheetDescription>Browse, edit, publish, and manage your products.</SheetDescription>
        </SheetHeader>

        <div className="flex justify-center pt-3 md:hidden">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>
        <ProductList onClose={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

/** "View all" trigger + its own modal instance — used in the Products section header. */
export function ProductListSheet() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
      >
        View all
      </button>

      <ProductListModal open={open} onOpenChange={setOpen} />
    </>
  );
}