/**
 * src/features/store/components/ProductList.tsx
 *
 * Changes:
 *  - Shows "Not production ready" tag on products where production_ready is false/absent
 *  - Share button now passes price, currencySymbol, and flags for Telegram Story
 */

"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ImageIcon, Pencil, Share2, X, Loader2, Plus,
  ChevronDown, PackageOpen, Globe, Trash2, PackageX,
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
import { storeProductApi, getRetailPrice, type ProductListItem } from "../api";
import { EditProductModal } from "./EditProductModal";
import { useConfirm } from "../../../shared/components/ConfirmModal";
import { useShareDrawer } from "@/shared/components/ShareDrawer";
import { BrandLoader } from "@/components/ui/loader";

//     Status badge                                                              

function StatusBadge({ status, is_published }: { status: string; is_published: boolean }) {
  const published = is_published || status === "published";
  const archived = status === "archived";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
      published ? "bg-green-500/10 text-green-600 dark:text-green-400"
      : archived ? "bg-border/60 text-muted-foreground"
      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
    }`}>
      {published ? "Published" : archived ? "Archived" : "Draft"}
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

//     Row action button                                                         

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

//     Product row                                                               

function ProductRow({
  product, onEdit, onMutated,
}: {
  product: ProductListItem & { production_ready?: boolean };
  onEdit: (p: ProductListItem) => void;
  onMutated: () => void;
}) {
  const [confirm, ConfirmModal] = useConfirm();
  const { openShareDrawer } = useShareDrawer();
  const isDraft = !product.is_published && product.status !== "archived";
  const isPublished = product.is_published || product.status === "published";
  // production_ready may not exist on older items — treat missing as false
  const isProductionReady = (product as any).production_ready === true;

  const publishMutation = useMutation({
    mutationFn: () => storeProductApi.publish(product.id),
    onSuccess: () => { toast.success("Product published!"); onMutated(); },
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

    // Extract price and currency from product data
    const productData = product as any;
    const price = productData.pricing?.retail_price ?? productData.retail_price;
    const currencySymbol = productData.pricing?.currency?.symbol ?? productData.currency?.symbol;

    openShareDrawer({
      title: product.title,
      url: product.public_link,
      imageUrl: product.thumbnail_url,
      productId: product.id,
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

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="flex items-center gap-3 rounded-2xl border border-border/50 bg-surface p-3 transition hover:border-border"
      >
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
          {isDraft && (
            <ActionBtn
              onClick={(e) => { e.stopPropagation(); publishMutation.mutate(); }}
              title="Publish"
              loading={publishMutation.isPending}
            >
              <Globe className="h-3.5 w-3.5" />
            </ActionBtn>
          )}
          {!isPublished && (
            <ActionBtn onClick={(e) => { e.stopPropagation(); onEdit(product); }} title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </ActionBtn>
          )}
          {isPublished && (
            <ActionBtn onClick={handleShare} title="Share">
              <Share2 className="h-3.5 w-3.5" />
            </ActionBtn>
          )}
          {!isPublished && (
            <ActionBtn onClick={handleDelete} title="Delete" loading={deleteMutation.isPending} danger>
              <Trash2 className="h-3.5 w-3.5" />
            </ActionBtn>
          )}
        </div>
      </motion.div>

      {ConfirmModal}
    </>
  );
}

//     ProductList                                                          

export function ProductList({ onClose }: { onClose: () => void }) {
  const [editTarget, setEditTarget] = useState<ProductListItem | null>(null);
  const qc = useQueryClient();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery(storeProductsInfiniteQuery(20));

  const allProducts = data?.pages.flatMap((p) => p.results) ?? [];
  const total = data?.pages[0]?.pagination?.total ?? 0;

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
            {total > 0 && <p className="text-xs text-muted-foreground">{total} total</p>}
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
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {allProducts.map((p) => (
                  <ProductRow key={p.id} product={p} onEdit={setEditTarget} onMutated={refresh} />
                ))}
              </AnimatePresence>

              {hasNextPage && (
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

//     Sheet trigger                                                             

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

      <Sheet open={open} onOpenChange={setOpen}>
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
          <ProductList onClose={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}