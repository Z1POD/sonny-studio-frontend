/**
 * src/features/designs/components/UserDesignsPage.tsx
 *
 * "My Designs" — lists all designs the user has created.
 * Similar layout to StoreDashboard but focused on the customer/creator
 * who wants to browse, reorder, edit, or delete their saved designs.
 *
 * Features:
 * - Filter tabs (All / Draft / Published / Archived)
 * - Design cards with thumbnail, mockup strip, pricing, actions
 * - Tap thumbnail → lightbox
 * - Tap card → DesignDetailSheet
 * - Quick actions: Edit, 3D view, Reorder, Delete
 * - Infinite scroll / load more
 */

import { useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pencil, Box, ShoppingCart, Trash2, Loader2,
  PenLine, ImageIcon, Globe, Archive, Plus, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { designsInfiniteQuery, designKeys } from "../queries";
import { storeProductApi, getRetailPrice } from "@/features/store/api";
import type { ProductListItem } from "@/features/store/api";
import { useConfirm } from "@/features/store/components/ConfirmModal";
import { useCheckoutStore } from "@/features/checkout/store";
import { DesignDetailSheet } from "./DesignDetailSheet";
import { DesignLightbox } from "./DesignLightbox";
import { CheckOut } from "@/features/checkout/components/CheckOut";

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { label: "All", value: "" },
  { label: "Drafts", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
];

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ design }: { design: ProductListItem }) {
  const isDraft = !design.is_published && design.status !== "archived";
  const isPublished = design.is_published || design.status === "published";
  const isArchived = design.status === "archived";

  if (isPublished)
    return (
      <Badge variant="default" className="gap-1 text-[10px] bg-green-500/15 text-green-600 border-green-500/20">
        <Globe className="h-2.5 w-2.5" />
        Live
      </Badge>
    );
  if (isArchived)
    return (
      <Badge variant="secondary" className="gap-1 text-[10px]">
        <Archive className="h-2.5 w-2.5" />
        Archived
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
      <PenLine className="h-2.5 w-2.5" />
      Draft
    </Badge>
  );
}

// ─── Quick action button ──────────────────────────────────────────────────────

function QuickBtn({
  onClick,
  title,
  loading,
  children,
  danger,
}: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  loading?: boolean;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur-sm transition disabled:opacity-40 ${
        danger
          ? "border-red-500/30 bg-red-500/20 text-red-400 hover:bg-red-500/40"
          : "border-white/30 bg-black/40 text-white/80 hover:bg-black/60"
      }`}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : children}
    </button>
  );
}

// ─── Design card ──────────────────────────────────────────────────────────────

function DesignCard({
  design,
  onOpenDetail,
  onMutated,
}: {
  design: ProductListItem;
  onOpenDetail: (d: ProductListItem) => void;
  onMutated: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openCheckout = useCheckoutStore((s) => s.open);
  const [confirm, ConfirmModal] = useConfirm();
  const [lightbox, setLightbox] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => storeProductApi.deleteProduct(design.id),
    onSuccess: () => {
      toast.success("Design deleted");
      queryClient.invalidateQueries({ queryKey: designKeys.all });
      onMutated();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: "Delete this design?",
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) deleteMutation.mutate();
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate({ to: "/studio", state: { productId: design.id } });
  };

  const handle3D = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate({ to: "/studio", state: { productId: design.id, mode: "3d" } });
  };

  const handleReorder = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Open checkout with basic info — detail sheet has the full variant data
    openCheckout({
      productId: design.id,
      productName: design.title,
      thumbnailUrl: design.thumbnail_url,
      basePrice: parseFloat(design.pricing?.base_price ?? "0"),
      printCost: 0,
      currencySymbol:
        typeof design.pricing?.currency === "object"
          ? design.pricing.currency.symbol
          : "Br",
      variants: [],
      artworks: {},
      printAreas: [],
    });
  };

  const handleThumbnailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLightbox(true);
  };

  const retailPrice = getRetailPrice(design);

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="group relative overflow-hidden md:rounded-3xl border border-border bg-surface"
      >
        {/* Thumbnail */}
        <div
          className="relative aspect-square w-full cursor-zoom-in overflow-hidden bg-muted"
          onClick={handleThumbnailClick}
        >
          {design.thumbnail_url ? (
            <img
              src={design.thumbnail_url}
              alt={design.title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}

          {/* Top-right overlay actions */}
          <div className="absolute right-2.5 top-2.5 flex flex-col gap-1.5 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
            <QuickBtn onClick={handleEdit} title="Edit in Studio">
              <Pencil className="h-3 w-3" />
            </QuickBtn>
            <QuickBtn onClick={handle3D} title="3D Canvas">
              <Box className="h-3 w-3" />
            </QuickBtn>
            <QuickBtn onClick={handleReorder} title="Order / Reorder">
              <ShoppingCart className="h-3 w-3" />
            </QuickBtn>
            <QuickBtn
              onClick={handleDelete}
              title="Delete design"
              loading={deleteMutation.isPending}
              danger
            >
              <Trash2 className="h-3 w-3" />
            </QuickBtn>
          </div>

          {/* Status badge */}
          <div className="absolute left-2.5 top-2.5">
            <StatusBadge design={design} />
          </div>
        </div>

        {/* Info — tappable for detail sheet */}
        <div
          className="cursor-pointer px-4 py-3"
          onClick={() => onOpenDetail(design)}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-sm font-medium leading-snug flex-1">
              {design.title}
            </p>
            <p className="shrink-0 text-sm font-semibold text-foreground">
              {retailPrice}
            </p>
          </div>

          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{design.sold_quantity} sold</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span>
              {new Date(design.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>

          {/* Reorder CTA strip */}
          <button
            onClick={(e) => { e.stopPropagation(); handleReorder(e); }}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/50 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            {design.sold_quantity > 0 ? "Reorder" : "Order Now"}
          </button>
        </div>
      </motion.div>

      {/* Lightbox (single thumbnail image) */}
      <AnimatePresence>
        {lightbox && design.thumbnail_url && (
          <DesignLightbox
            images={[{ url: design.thumbnail_url, label: design.title }]}
            initialIndex={0}
            onClose={() => setLightbox(false)}
          />
        )}
      </AnimatePresence>

      {ConfirmModal}
    </>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyDesigns({ filtered, onNewDesign }: { filtered: boolean; onNewDesign: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-6">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-muted">
        <PenLine className="h-7 w-7 text-muted-foreground/50" />
      </div>
      <p className="text-base font-semibold">
        {filtered ? "No designs here" : "No designs yet"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {filtered
          ? "Try a different filter."
          : "Designs you create in the studio will appear here."}
      </p>
      {!filtered && (
        <Button className="mt-5 gap-2" onClick={onNewDesign}>
          <Plus className="h-4 w-4" />
          Create your first design
        </Button>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function UserDesignsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("");
  const [selectedDesign, setSelectedDesign] = useState<ProductListItem | null>(null);

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, error, refetch } =
    useInfiniteQuery(
      designsInfiniteQuery({ status: activeTab || undefined }),
    );

  const allDesigns = data?.pages.flatMap((p) => p.results) ?? [];

  const handleMutated = () => refetch();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/90 px-4 pb-0 pt-4 backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">My Designs</h1>
          <Button
            size="sm"
            className="gap-1.5 rounded-full"
            onClick={() => navigate({ to: "/studio" })}
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 overflow-x-auto pb-3 scrollbar-none">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                activeTab === tab.value
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-1 md:px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <AlertCircle className="h-8 w-8 text-destructive/60" />
            <p className="text-sm text-muted-foreground">Failed to load designs</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : allDesigns.length === 0 ? (
          <EmptyDesigns
            filtered={!!activeTab}
            onNewDesign={() => navigate({ to: "/studio" })}
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-0 md:gap-3 overflow-hidden rounded-t-3xl md:rounded-0">
              {allDesigns.map((design) => (
                <DesignCard
                  key={design.id}
                  design={design}
                  onOpenDetail={setSelectedDesign}
                  onMutated={handleMutated}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Load more */}
        {hasNextPage && (
          <div className="mt-5 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? (
                <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Loading…</>
              ) : (
                "Load more"
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Detail sheet */}
      <DesignDetailSheet
        design={selectedDesign}
        onClose={() => setSelectedDesign(null)}
        onMutated={handleMutated}
      />

      {/* Checkout overlay */}
      <CheckOut />
    </div>
  );
}