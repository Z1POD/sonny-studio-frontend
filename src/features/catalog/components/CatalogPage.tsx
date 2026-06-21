"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from '@tanstack/react-router'
import { motion } from "framer-motion";
import { ImageIcon, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLightbox } from "@/shared/hooks/use-overlays";
import { catalogListQuery, catalogCategoriesQuery } from "../queries";
import type { CatalogBlank, Category } from "../api";

// ─── Helper: format price with currency ─────────────────────────────────────

function formatPrice(pricing: CatalogBlank["pricing"]): string {
  const symbol = pricing.currency.symbol;
  const base = parseFloat(pricing.base_price) || 0;
  return `${symbol}${base.toFixed(2)}`;
}

// ─── Helper: get category slug for filtering ──────────────────────────────────

function getCategorySlug(category: Category | string): string {
  if (typeof category === "string") return category;
  return category.slug;
}

// ─── CatalogPage ──────────────────────────────────────────────────────────────

export function CatalogPage() {
  const { data, isLoading } = useQuery(catalogListQuery());
  const { data: categoriesData } = useQuery(catalogCategoriesQuery());
  const lightbox = useLightbox();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  // Build category filter tabs from API + "All"
  const categories = useMemo(() => {
    const apiCategories = categoriesData?.data ?? [];
    return [
      { id: "all" as const, label: "All" },
      ...apiCategories.map((c) => ({ id: c.slug, label: c.name })),
    ];
  }, [categoriesData]);

  const items = useMemo(() => {
    const all = data?.results ?? [];
    return all.filter((b) => {
      const matchCat =
        activeCategory === "all" || getCategorySlug(b.category) === activeCategory;
      const matchQ =
        !q.trim() ||
        b.name.toLowerCase().includes(q.toLowerCase()) ||
        b.brand.name.toLowerCase().includes(q.toLowerCase());
      return matchCat && matchQ;
    });
  }, [data, activeCategory, q]);

  const handleCustomize = (apparelId: string) => {
    navigate({
      to: "/studio",
      state: { apparelId } as Record<string, string>,
    });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-2 pb-24 pt-6 sm:px-8">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-4 px-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Apparel catalog
          </h1>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Pick a blank to drop into the studio. Prices start from supplier
            base — your margin is set per product.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search blanks, suppliers…"
            className="rounded-full bg-surface pl-9"
          />
        </div>
      </motion.header>

      <div className="mt-6 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCategory(c.id)}
            className={
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition " +
              (activeCategory === c.id
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-surface text-muted-foreground hover:text-foreground")
            }
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-t-2xl border-border gap-0 sm:grid-cols-3 lg:grid-cols-4 sm:gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-2xl bg-surface"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-border bg-surface/60 p-10 text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-overlay text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold">No matches</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different category or clear the search.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-t-2xl border-border gap-0 sm:grid-cols-3 lg:grid-cols-4 sm:gap-3">
          {items.map((b) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="group overflow-hidden border border-border bg-surface sm:rounded-2xl lg:rounded-2xl"
            >
              <button
                type="button"
                onClick={() =>
                  lightbox.open([{ src: b.thumbnail_url, caption: b.name }], 0)
                }
                className="block w-full"
              >
                <div className="relative aspect-square overflow-hidden bg-surface-overlay">
                  <img
                    src={b.thumbnail_url}
                    alt={b.name}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                </div>
              </button>
              <div className="space-y-2 p-3">
                <div>
                  <div className="truncate text-sm font-medium">{b.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {b.brand.name} · {b.available_colors.count} colors
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>From {formatPrice(b.pricing)}</span>
                  <span>{b.available_sizes.sizes.join(" · ")}</span>
                </div>

                <Button
                  size="sm"
                  className="w-full rounded-full"
                  onClick={() => handleCustomize(b.id)}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Customize it
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
