/**
 * src/features/store/components/DiscountSuggestionCard.tsx
 *
 * Adaptive "Suggested next step" card:
 *  1. No products        → "Spin up your first design"
 *  2. No published yet   → "Publish & share"
 *  3. Has published      → CTA opens DiscountOverlay
 *                           (DiscountsSheet: bottom sheet on mobile, dialog on desktop)
 */

"use client";

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, Tag, Globe, Share2 } from "lucide-react";
import { appToast as toast } from "@/lib/toaster";
import { Button } from "@/components/ui/button";
import { publishBlockerMessage, type ProductListItem } from "../api";
import { useShareDrawer } from "@/shared/components/ShareDrawer";
import { DiscountsSheet } from "./DiscountsSheet";

//     Public: the suggestion card tile                                         

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
              onClick={() => {
                const blocked = publishBlockerMessage(firstDraft);
                if (blocked) {
                  toast.info(blocked);
                  return;
                }
                openShareDrawer({
                  title: firstDraft.title,
                  slug: firstDraft.slug,
                  url: firstDraft.public_link,
                  imageUrl: firstDraft.thumbnail_url ?? undefined,
                  productId: firstDraft.id,
                  shouldPublish: true,
                });
              }}
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

      <DiscountsSheet
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        publishedProducts={publishedProducts}
      />
    </>
  );
}