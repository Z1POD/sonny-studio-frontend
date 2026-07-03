"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ImageIcon, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLightbox } from "@/shared/hooks/use-overlays";
import { catalogListQuery, catalogCategoriesQuery } from "../queries";
import type { CatalogBlank, Category } from "../api";

function formatPrice(pricing: CatalogBlank["pricing"]): string {
  const symbol = pricing.currency.symbol;
  const base = parseFloat(pricing.base_price) || 0;
  return `${symbol}${base.toFixed(2)}`;
}

function getCategorySlug(category: Category | string): string {
  if (typeof category === "string") return category;
  return category.slug;
}

export function CatalogPage() {
  const { data, isLoading } = useQuery(catalogListQuery());
  const { data: categoriesData } = useQuery(catalogCategoriesQuery());
  const lightbox = useLightbox();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  // Track active item for mobile tap states or desktop hovers safely
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

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

  const [isOpeningStudio, setIsOpeningStudio] = useState(false);

  const handleCustomize = (apparelId: string) => {
    if (isOpeningStudio) return;

    setIsOpeningStudio(true);

    navigate({
      to: "/studio",
      state: { apparelId } as Record<string, string>,
    });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-8 select-none">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
        className="flex flex-col gap-4 px-1 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Apparel catalog
          </h1>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Pick a premium blank apparel and personalize it with your own unique designs. 
            Make something meaningful for yourself or someone special, and get it delivered with ease.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search blanks, brands…"
            className="rounded-full h-11 bg-muted/50 border-transparent pl-10 focus-visible:ring-2 focus-visible:ring-foreground/20"
          />
        </div>
      </motion.header>

      {/* Categories - Apple Style pill selector */}
      <div className="mt-6 flex gap-2 overflow-x-auto pb-3 pt-1 no-scrollbar mask-image-horizontal">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCategory(c.id)}
            className={
              "rounded-full h-9 px-4 text-sm font-medium transition-all duration-200 active:scale-95 shrink-0 " +
              (activeCategory === c.id
                ? "bg-foreground text-background shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground")
            }
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[3/4] animate-pulse rounded-2xl bg-muted/40"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-12 rounded-3xl border border-dashed border-border bg-muted/20 p-12 text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold">No matches found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different category or change your keywords.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((b) => {
            const isShowingDetails = hoveredItemId === b.id;

            return (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                onMouseEnter={() => setHoveredItemId(b.id)}
                onMouseLeave={() => setHoveredItemId(null)}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button")) {
                    return;
                  }

                  setHoveredItemId(isShowingDetails ? null : b.id);
                }}
                className="
                  group relative
                  aspect-[4/4] sm:aspect-[3/4]
                  w-full
                  overflow-hidden
                  rounded-2xl
                  bg-muted/30
                  border border-muted/40
                "
              >
                {/* Main Product Image */}
                <div className="absolute inset-0 h-full w-full overflow-hidden">
                  <img
                    src={b.thumbnail_url}
                    alt={b.name}
                    className="h-full w-full object-cover transition-transform duration-700 ease-[0.25,1,0.5,1] group-hover:scale-105"
                  />
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/40 via-black/10 to-transparent pt-8 text-white transition-opacity duration-300 group-hover:opacity-0 pointer-events-none">
                  <p className="truncate text-sm font-semibold tracking-tight">{b.name}</p>
                  <p className="text-xs text-white/80 mt-0.5">{formatPrice(b.pricing)}</p>
                </div>

                {/* Blur Fadeup Interactive Overlay */}
                <AnimatePresence>
                  {isShowingDetails && (
                    <motion.div
                      initial={{ opacity: 0, backdropFilter: "blur(0px)", y: "15%" }}
                      animate={{ opacity: 1, backdropFilter: "blur(16px)", y: "0%" }}
                      exit={{ opacity: 0, backdropFilter: "blur(0px)", y: "15%" }}
                      transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
                      className="
                        absolute inset-0 z-10
                        flex flex-col justify-between
                        bg-black/25
                        p-3 sm:p-4
                        text-white
                        pointer-events-none
                      "
                    >
                      {/* Top Action Track: Lightbox Quick Peek */}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            lightbox.open(
                              [{ src: b.thumbnail_url, caption: b.name }],
                              0
                            );
                          }}
                          className="
                            pointer-events-auto
                            flex h-8 w-8 sm:h-9 sm:w-9
                            items-center justify-center
                            rounded-full
                            bg-white/20
                            text-white
                            backdrop-blur-md
                            transition
                            active:scale-90
                          "
                        >
                          <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </button>
                      </div>

                      {/* Bottom Layout Details Stack */}
                      <div className="space-y-2 sm:space-y-3.5 min-h-0 flex flex-col justify-end">
                        <div className="space-y-0.5 sm:space-y-1">
                          <span className="inline-block rounded bg-white/20 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                            {b.brand.name}
                          </span>
                          <h4 className="text-sm sm:text-base font-semibold leading-tight tracking-tight line-clamp-2">
                            {b.name}
                          </h4>
                          <p className="text-base sm:text-lg font-bold tracking-tight text-white/95">
                            {formatPrice(b.pricing)}
                          </p>
                        </div>

                        {/* Attributes */}
                        <div className="border-t border-white/10 pt-1.5 sm:pt-2 text-white/80">
                          {/* Mobile */}
                          <div className="sm:hidden space-y-0.5 text-[10px] leading-tight">
                            <div className="flex justify-between items-center">
                              <span className="opacity-70">Colors</span>

                              <div className="flex items-center gap-1">
                                {b.available_colors.colors.slice(0, 4).map((color) => (
                                  <span
                                    key={color.name}
                                    title={color.name}
                                    className="h-3 w-3 rounded-full border border-white/30"
                                    style={{ backgroundColor: color.hex }}
                                  />
                                ))}

                                {b.available_colors.colors.length > 4 && (
                                  <span className="ml-1 text-[9px] font-medium">
                                    +{b.available_colors.colors.length - 4}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex justify-between">
                              <span className="opacity-70">Sizes</span>
                              <span className="truncate max-w-[60%] text-right">
                                {b.available_sizes.sizes.join(", ")}
                              </span>
                            </div>
                          </div>

                          {/* Tablet/Desktop */}
                          <div className="hidden sm:block space-y-1.5 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="opacity-70">Colors</span>

                              <div className="flex items-center gap-1">
                                {b.available_colors.colors.slice(0, 4).map((color) => (
                                  <span
                                    key={color.name}
                                    title={color.name}
                                    className="h-3 w-3 rounded-full border border-white/30"
                                    style={{ backgroundColor: color.hex }}
                                  />
                                ))}

                                {b.available_colors.colors.length > 4 && (
                                  <span className="ml-1 text-[9px] font-medium">
                                    +{b.available_colors.colors.length - 4}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-medium opacity-70">Sizes</span>
                              <span className="font-semibold truncate max-w-[70%] text-right">
                                {b.available_sizes.sizes.join(", ")}
                              </span>
                            </div>
                          </div>
                        </div>

                        <Button
                          disabled={isOpeningStudio}
                          size="default"
                          className="
                            pointer-events-auto
                            w-full
                            h-9 sm:h-11
                            text-xs sm:text-sm
                            rounded-xl
                            bg-white
                            text-black
                            font-semibold
                            shadow-lg
                            transition-all
                            duration-200
                            hover:bg-white/90
                            active:scale-[0.98]
                            mt-1
                          "
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCustomize(b.id);
                          }}
                        >
                          <Plus className="mr-1 sm:mr-1.5 h-3.5 w-3.5 sm:h-4 w-4 stroke-[2.5]" />
                          {isOpeningStudio ? "Opening..." : "Customize"}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}