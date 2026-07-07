// src/features/designs/components/UserDesignsPage.tsx
import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { designsInfiniteQuery } from "../queries";
import type { ProductListItem } from "@/features/store/api";
import { DesignDetailSheet } from "./DesignDetailSheet";
import { CheckOut } from "@/features/checkout/components/CheckOut";
import { DesignCard } from "./DesignCard";
import { EmptyDesigns } from "./EmptyDesigns";
import { BrandLoader } from "@/components/ui/loader";
import { AlertCircle, Plus } from "lucide-react";
import { EditProductModal } from "@/features/store/components/EditProductModal";

const FILTER_TABS = [
  { label: "All", value: "" },
  { label: "Drafts", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
];

export function UserDesignsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("");
  const [selectedDesign, setSelectedDesign] = useState<ProductListItem | null>(null);
  const [editDesignId, setEditDesignId] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useInfiniteQuery(
    designsInfiniteQuery({ status: activeTab || undefined }),
  );

  const allDesigns = data?.pages.flatMap((p) => p.results) ?? [];

  return (
    <div className="flex h-full flex-col">
      {/* Sticky header + filter tabs */}
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/90 px-4 pb-0 pt-4 backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">My Designs</h1>
          <Button
            size="sm"
            className="gap-1.5 rounded-full"
            onClick={() => navigate({ to: "/catalog" })}
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>

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
      <div className="flex-1 overflow-y-auto px-1 md:px-4 py-4 no-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <BrandLoader />
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 md:gap-3 overflow-hidden rounded-t-3xl">
              {allDesigns.map((design) => (
                <DesignCard
                  key={design.id}
                  design={design}
                  onOpenDetail={setSelectedDesign}
                  onOpenEdit={(d) => setEditDesignId(d.id)}
                  onMutated={() => refetch()}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {hasNextPage && (
          <div className="mt-5 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? (
                <>
                  <BrandLoader size="sm" className="mr-2" />
                  Loading...
                </>
              ) : (
                "Load more"
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Design detail sheet */}
      <DesignDetailSheet
        design={selectedDesign}
        onClose={() => setSelectedDesign(null)}
        onEdit={(d) => { setSelectedDesign(null); setEditDesignId(d.id); }}
        onMutated={() => refetch()}
      />

      {/* Checkout overlay */}
      <CheckOut />

      {/* Edit product modal — details, pricing, variants, and a way into Studio */}
      {editDesignId && (
        <EditProductModal
          productId={editDesignId}
          onClose={() => setEditDesignId(null)}
          onSaved={() => {
            setEditDesignId(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}