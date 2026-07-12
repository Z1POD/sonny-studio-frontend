// src/features/market/components/MarketplacePage.tsx

"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { Loader2, Search, Sparkles, Fingerprint } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { haptics } from "@/shared/lib/haptics";
import { homepageQuery, productsInfiniteQuery } from "../queries";
import { ProductCard } from "./ProductCard";
import { getStockBadge } from "../stock";
import type { ProductListItem, ProductListParams } from "../types";

const SWIPE_THRESHOLD = 60;
const SWIPE_VELOCITY_THRESHOLD = 0.4;

const SWIPE_HINT_SHOWN_KEY = "marketplace_swipe_hint_shown";

type MarketSearch = {
  q?: string;
  category?: string;
  store?: string;
  sort?: ProductListParams["sort"];
};

export function MarketplacePage() {
  const search = useSearch({ strict: false }) as MarketSearch;
  const navigate = useNavigate();

  const { data: homepage, isLoading: isHomepageLoading } = useQuery(homepageQuery());

  const filters: Omit<ProductListParams, "page"> = useMemo(
    () => ({
      q: search.q || undefined,
      category: search.category || undefined,
      store: search.store || undefined,
      sort: search.sort || "popular",
      page_size: 12,
    }),
    [search.q, search.category, search.store, search.sort],
  );

  const isFiltered = Boolean(search.q || search.category || search.store);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery(
    productsInfiniteQuery(filters),
  );

  const products = data?.pages.flatMap((p) => p.products) ?? [];
  const total = data?.pages[0]?.total_results ?? 0;

  const heroCollection = homepage?.hero[0];

  const carouselProducts: ProductListItem[] = useMemo(() => {
    const pools = [
      heroCollection?.products ?? [],
      homepage?.trending.products ?? [],
      homepage?.new_arrivals.products ?? [],
      products.slice(0, 20),
    ];
    const seen = new Set<string>();
    const combined: ProductListItem[] = [];
    for (const pool of pools) {
      for (const p of pool) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          combined.push(p);
        }
      }
    }
    return combined;
  }, [heroCollection, homepage?.trending.products, homepage?.new_arrivals.products, products]);

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (carouselProducts.length === 0) return;
    setActiveIndex((i) => ((i % carouselProducts.length) + carouselProducts.length) % carouselProducts.length);
  }, [carouselProducts.length]);

  const featured = carouselProducts.length > 0 ? carouselProducts[activeIndex] : undefined;
  const hasMultipleSlides = carouselProducts.length > 1;
  const featuredStockBadge = featured ? getStockBadge(featured) : null;

  const slideDirectionRef = useRef<"next" | "prev">("next");

  const [showSwipeHint, setShowSwipeHint] = useState(() => {
    if (typeof window === "undefined") return true;
    return sessionStorage.getItem(SWIPE_HINT_SHOWN_KEY) !== "1";
  });

  // Trigger large haptic when swipe hint first appears
  const hintHapticFiredRef = useRef(false);
  useEffect(() => {
    if (showSwipeHint && hasMultipleSlides && !hintHapticFiredRef.current) {
      hintHapticFiredRef.current = true;
      haptics.impactOccurred("heavy");
    }
  }, [showSwipeHint, hasMultipleSlides]);

  const [heroImageLoaded, setHeroImageLoaded] = useState(false);

  useEffect(() => {
    setHeroImageLoaded(false);
  }, [featured?.id]);

  const goToNextSlide = useCallback(() => {
    slideDirectionRef.current = "next";
    setActiveIndex((i) =>
      carouselProducts.length ? (i + 1) % carouselProducts.length : 0,
    );
  }, [carouselProducts.length]);

  const goToPrevSlide = useCallback(() => {
    slideDirectionRef.current = "prev";
    setActiveIndex((i) =>
      carouselProducts.length ? (i - 1 + carouselProducts.length) % carouselProducts.length : 0,
    );
  }, [carouselProducts.length]);

  const dismissSwipeHint = useCallback(() => {
    setShowSwipeHint(false);
    try {
      sessionStorage.setItem(SWIPE_HINT_SHOWN_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  // Guards against the click-after-drag problem: a swipe ends with a
  // pointerup in the same place a tap's pointerup would land, so without
  // this flag every swipe would also fire the tap-to-open-PDP handler.
  const justDraggedRef = useRef(false);

  const handleDragStart = useCallback(() => {
    justDraggedRef.current = true;
    dismissSwipeHint();
  }, [dismissSwipeHint]);

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const isSwipe =
        Math.abs(info.offset.x) > SWIPE_THRESHOLD ||
        Math.abs(info.velocity.x) > SWIPE_VELOCITY_THRESHOLD * 1000;

      if (isSwipe) {
        if (info.offset.x < 0) goToNextSlide();
        else goToPrevSlide();
      }

      // Let the click event that follows pointerup see the flag, then clear it.
      requestAnimationFrame(() => {
        justDraggedRef.current = false;
      });
    },
    [goToNextSlide, goToPrevSlide],
  );

  // Programmatic navigation on tap — only fires for a genuine tap, gated by
  // justDraggedRef so a swipe never opens the product detail page.
  const handleCardTap = useCallback(() => {
    if (justDraggedRef.current) return;
    if (featured) {
      haptics.impactOccurred("light");
      navigate({ to: "/product/$slug", params: { slug: featured.slug } });
    }
  }, [featured, navigate]);

  const slideVariants = {
    enter: (dir: 1 | -1) => ({ x: dir > 0 ? "100%" : "-100%" }),
    center: { x: 0 },
    exit: (dir: 1 | -1) => ({ x: dir > 0 ? "-100%" : "100%" }),
  };
  const slideDirection = slideDirectionRef.current === "prev" ? -1 : 1;

  return (
    <div>
      {/* HERO */}
      {!isFiltered && homepage && (
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />
          </div>

          <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 pb-16 pt-10 md:grid-cols-2 md:gap-16 md:px-8 md:pb-24 md:pt-16">
            <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-gold">
                    <Sparkles className="h-3 w-3" />
                    {heroCollection?.name ?? "Sonny | Marketplace"}
                </span>

                <h1 className="mt-5 text-4xl font-semibold leading-[1.02] tracking-[-0.04em] md:text-6xl">
                    Made to order.
                    <br />
                    <span className="text-gold">Designed by you.</span>
                </h1>

                <p className="mt-4 max-w-md block text-sm leading-relaxed text-muted-foreground md:mt-5 md:hidden">
                    {heroCollection?.description ??
                    "Design custom products, order your favorites, or sell your creations, we handle production and delivery."}
                </p>
                <p className="mt-5 hidden max-w-md text-base text-muted-foreground md:block">
                    {heroCollection?.description ??
                    "Customize tees, hoodies, bags, mugs, bottles and more in our design studio. Keep your creation or publish it to the marketplace, we handle production, fulfillment, and delivery."}
                </p>

                <div className="mt-6 flex flex-wrap gap-3 md:mt-7">
                    {featured && (
                    <Link
                        to="/product/$slug"
                        params={{ slug: featured.slug }}
                        onClick={() => haptics.impactOccurred("light")}
                        className="inline-flex h-10 md:h-12 items-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background transition-transform active:scale-[0.98]"
                    >
                        Shop now
                    </Link>
                    )}

                    <a
                    href="#shop-all"
                    onClick={() => haptics.impactOccurred("light")}
                    className="inline-flex h-10 md:h-12 items-center rounded-full border border-border bg-surface px-6 text-sm font-medium transition-colors hover:border-gold"
                    >
                    Browse all
                    </a>
                </div>
            </div>

            {featured && (
              <div className="relative select-none max-h-[80dvh] overflow-hidden rounded-[2rem] md:aspect-[4/5]">
                <AnimatePresence mode="popLayout" custom={slideDirection} initial={false}>
                  <motion.div
                    key={featured.id}
                    custom={slideDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: "spring", stiffness: 300, damping: 32 }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.6}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onClick={handleCardTap}
                    className="relative block aspect-square w-full cursor-grab overflow-hidden rounded-[2rem] border border-border bg-surface active:cursor-grabbing md:aspect-[4/5]"
                    style={{ touchAction: "pan-y" }}
                  >
                    {!heroImageLoaded && (
                      <div className="absolute inset-0 z-10 animate-pulse bg-muted/40" />
                    )}

                    <img
                      src={featured.thumbnail_url || featured.mockup_url || ""}
                      alt={featured.title}
                      className="h-full w-full object-cover pointer-events-none"
                      draggable={false}
                      onLoad={() => setHeroImageLoaded(true)}
                    />

                    {featuredStockBadge && (
                      <span
                        className={
                          "absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] backdrop-blur-2 " +
                          (featuredStockBadge.kind === "out"
                            ? "bg-red-600 text-white"
                            : featuredStockBadge.kind === "limited"
                              ? "border border-gold bg-background/20 text-gold"
                              : "bg-foreground text-background")
                        }
                      >
                        {featuredStockBadge.label}
                      </span>
                    )}

                    <div className="absolute bottom-2 left-4 right-4 flex items-end justify-between rounded-2xl border border-border bg-background/70 px-4 py-3 backdrop-blur">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          {featured.store.name}
                        </p>
                        <p className="text-sm font-semibold line-clamp-2">{featured.title}</p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatPrice(featured.retail_price, featured.currency)}
                      </p>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* SWIPE HINT OVERLAY */}
                {hasMultipleSlides && showSwipeHint && (
                  <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                    <style>{`
                      @keyframes swipeHintFade {
                        0%, 100% { opacity: 0; }
                        12%, 88% { opacity: 1; }
                      }
                      @keyframes fingerSwipe {
                        0% { transform: translateX(-18px) rotate(-6deg) scale(.96); }
                        18% { transform: translateX(-18px) rotate(-6deg) scale(1); }
                        50% { transform: translateX(18px) rotate(6deg) scale(1); }
                        68% { transform: translateX(18px) rotate(6deg) scale(1); }
                        100% { transform: translateX(-18px) rotate(-6deg) scale(.96); }
                      }
                      @keyframes fingerGlow {
                        0% { transform: translateX(-18px) scale(.8); opacity: .18; }
                        50% { transform: translateX(18px) scale(1.3); opacity: .45; }
                        100% { transform: translateX(-18px) scale(.8); opacity: .18; }
                      }
                      @keyframes fingerRipple {
                        0%,100% { transform: translateX(-18px) scale(.65); opacity: 0; }
                        12% { opacity: .35; }
                        25% { transform: translateX(-18px) scale(1.7); opacity: 0; }
                        50% { transform: translateX(18px) scale(.65); opacity: 0; }
                        62% { opacity: .35; }
                        75% { transform: translateX(18px) scale(1.7); opacity: 0; }
                      }
                      @keyframes breathe {
                        0%,100% { transform: scale(.98); }
                        50% { transform: scale(1.02); }
                      }
                    `}</style>

                    <div
                      className="flex h-[94%] w-[94%] flex-col items-center justify-center gap-4 rounded-2xl px-8 py-4 backdrop-blur-md"
                      style={{
                        backgroundColor: "rgba(8, 59, 50, 0.65)",
                        animation: "swipeHintFade 6.5s ease-in-out both",
                      }}
                    >
                      <div
                        className="relative flex h-20 w-32 items-center justify-center"
                        style={{ animation: "breathe 2.8s ease-in-out infinite" }}
                      >
                        <div
                          className="absolute h-10 w-10 rounded-full bg-white/20 blur-xl"
                          style={{ animation: "fingerGlow 2.2s ease-in-out infinite" }}
                        />
                        <div
                          className="absolute h-12 w-12 rounded-full border border-white/25"
                          style={{ animation: "fingerRipple 2.2s ease-in-out infinite" }}
                        />
                        <div
                          className="relative z-10"
                          style={{ animation: "fingerSwipe 2.2s cubic-bezier(.4,0,.2,1) infinite" }}
                        >
                          <Fingerprint className="h-9 w-9 text-white/90 drop-shadow-[0_2px_10px_rgba(255,255,255,0.35)]" />
                        </div>
                      </div>

                      <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-gold/80">
                        Swipe
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {!isFiltered && isHomepageLoading && (
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 md:px-8">
          <div className="h-64 animate-pulse rounded-[2rem] bg-muted/40" />
        </div>
      )}

      {/* TRENDING */}
      {!isFiltered && homepage && homepage.trending.products.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16 md:px-8">
          <div className="mb-6">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {homepage.trending.title}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
              In rotation now
            </h2>
          </div>
          <div className="grid auto-rows-[260px] grid-cols-2 gap-2 md:grid-cols-4 sm:gap-3 md:gap-4">
            {homepage.trending.products.slice(0, 6).map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                size={i === 0 ? "tall" : i === 3 ? "wide" : "default"}
              />
            ))}
          </div>
        </section>
      )}

      {/* NEW ARRIVALS */}
      {!isFiltered && homepage && homepage.new_arrivals.products.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-24 md:px-8">
          <div className="mb-6">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {homepage.new_arrivals.title}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
              Fresh from the studio
            </h2>
          </div>
          <div className="grid auto-rows-[260px] grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
            {homepage.new_arrivals.products.slice(0, 6).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* FEATURED CREATORS */}
      {!isFiltered && homepage && homepage.top_stores.length > 0 && (
        <section className="mx-auto max-w-7xl border-t border-border px-4 py-14 md:px-8">
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Featured creators</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
            {homepage.top_stores.map((s) => (
              <button
                key={s.slug}
                onClick={() => {
                  haptics.impactOccurred("light");
                  navigate({ to: "/marketplace", search: { store: s.slug } });
                }}
                className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-5 text-left transition-all hover:border-gold"
              >
                {s.banner_url && (
                  <img
                    src={s.banner_url}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-20 transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-surface/40 to-transparent" />
                <div className="relative z-10">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Storefront
                  </p>
                  <p className="mt-2 text-lg font-semibold tracking-tight">{s.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.product_count} pieces</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* SHOP ALL */}
      <section
        id="shop-all"
        className="mx-auto max-w-7xl border-t border-border px-4 py-14 md:px-8"
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {isFiltered ? "Results" : "Shop all"}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
              {search.q ? `"${search.q}"` : search.store ? "Storefront pieces" : "Every piece"}
            </h2>
            {total > 0 && <p className="mt-1 text-xs text-muted-foreground">{total} products</p>}
          </div>
          {isFiltered && (
            <Link
              to="/marketplace"
              onClick={() => haptics.impactOccurred("light")}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Clear filters
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-2xl bg-muted/40" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-muted/20 p-12 text-center">
            <Search className="mx-auto mb-3 h-5 w-5 text-muted-foreground" />
            <h3 className="text-base font-semibold">No pieces found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different search or clear your filters to see more pieces.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>

            {hasNextPage && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => {
                    haptics.impactOccurred("light");
                    fetchNextPage();
                  }}
                  disabled={isFetchingNextPage}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-6 text-sm font-medium transition hover:border-gold disabled:opacity-50"
                >
                  {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isFetchingNextPage ? "Loading…" : "Load more pieces"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}