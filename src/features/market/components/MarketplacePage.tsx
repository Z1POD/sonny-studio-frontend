// src/features/market/components/MarketplacePage.tsx

"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Loader2, Search, Sparkles, Fingerprint } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { useTelegram } from "@/shared/hooks/use-telegram";
import { homepageQuery, productsInfiniteQuery } from "../queries";
import { ProductCard } from "./ProductCard";
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

  const { impactOccurred, selectionChanged } = useTelegram();

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
      impactOccurred("heavy");
    }
  }, [showSwipeHint, hasMultipleSlides, impactOccurred]);

  const [heroImageLoaded, setHeroImageLoaded] = useState(false);

  // ---- SMOOTH SWIPE STATE ----
  // Using a single state object for transform values to batch updates
  const [swipeState, setSwipeState] = useState<{
    offset: number;
    rotate: number;
    scale: number;
    isDragging: boolean;
    isAnimating: boolean;
  }>({
    offset: 0,
    rotate: 0,
    scale: 1,
    isDragging: false,
    isAnimating: false,
  });

  // Refs for gesture tracking (not state - avoids re-renders during drag)
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const dragCurrentX = useRef(0);
  const dragStartTime = useRef(0);
  const isSwiping = useRef(false);
  const isHorizontalSwipe = useRef<boolean | null>(null);

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

  // Reset swipe state with spring animation
  const springBack = useCallback(() => {
    setSwipeState({
      offset: 0,
      rotate: 0,
      scale: 1,
      isDragging: false,
      isAnimating: false,
    });
  }, []);

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    dragStartX.current = clientX;
    dragStartY.current = clientY;
    dragCurrentX.current = clientX;
    dragStartTime.current = Date.now();
    isSwiping.current = false;
    isHorizontalSwipe.current = null;

    setSwipeState({
      offset: 0,
      rotate: 0,
      scale: 1,
      isDragging: true,
      isAnimating: false,
    });
  }, []);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (dragStartX.current === 0) return;

    const deltaX = clientX - dragStartX.current;
    const deltaY = clientY - dragStartY.current;
    dragCurrentX.current = clientX;

    // Determine swipe direction on first significant movement
    if (isHorizontalSwipe.current === null && (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8)) {
      isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
    }

    // If scrolling vertically, ignore
    if (isHorizontalSwipe.current === false) return;

    // Horizontal swipe detected
    if (Math.abs(deltaX) > 10) {
      isSwiping.current = true;
      setShowSwipeHint(false);
      try {
        sessionStorage.setItem(SWIPE_HINT_SHOWN_KEY, "1");
      } catch {
        /* ignore */
      }
    }

    // Apply resistance at edges
    const resistance = 0.6;
    const resistedDelta = deltaX * resistance;

    setSwipeState({
      offset: resistedDelta,
      rotate: resistedDelta * 0.03,
      scale: 1 - Math.abs(resistedDelta) * 0.00025,
      isDragging: true,
      isAnimating: false,
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragStartX.current === 0) return;

    const deltaX = dragCurrentX.current - dragStartX.current;
    const deltaTime = Date.now() - dragStartTime.current;
    const velocity = Math.abs(deltaX) / (deltaTime || 1);

    // Swipe threshold: either distance OR velocity-based flick
    const isSwipe = Math.abs(deltaX) > SWIPE_THRESHOLD || (velocity > SWIPE_VELOCITY_THRESHOLD && Math.abs(deltaX) > 20);

    if (isSwipe && isHorizontalSwipe.current === true) {
      if (deltaX < 0) {
        impactOccurred("light");
        goToNextSlide();
      } else {
        impactOccurred("light");
        goToPrevSlide();
      }
    }

    // Always spring back (slide change will replace the card anyway)
    springBack();

    // Reset refs
    dragStartX.current = 0;
    dragStartY.current = 0;
    dragCurrentX.current = 0;
    isHorizontalSwipe.current = null;
  }, [goToNextSlide, goToPrevSlide, impactOccurred, springBack]);

  // Programmatic navigation on tap
  const handleCardTap = useCallback(() => {
    if (isSwiping.current) {
      isSwiping.current = false;
      return;
    }
    if (featured) {
      selectionChanged();
      navigate({ to: "/product/$slug", params: { slug: featured.slug } });
    }
  }, [featured, navigate, selectionChanged]);

  // Card styles
  const cardDropStyle = {
    animation: swipeState.isDragging || swipeState.isAnimating ? undefined : "heroCardDropIn 520ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
    "--drop-x": slideDirectionRef.current === "prev" ? "-28px" : "28px",
    
  } as CSSProperties;

  const swipeTransformStyle: CSSProperties = {
    transform: `translateX(${swipeState.offset}px) rotate(${swipeState.rotate}deg) scale(${swipeState.scale})`,
    transition: swipeState.isDragging ? "none" : "transform 250ms ease-out",
    cursor: swipeState.isDragging ? "grabbing" : "grab",
    touchAction: "pan-y",
    userSelect: "none",
    willChange: swipeState.isDragging ? "transform" : undefined,
  };

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
                        className="inline-flex h-10 md:h-12 items-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background transition-transform active:scale-[0.98]"
                    >
                        Shop now
                    </Link>
                    )}

                    <a
                    href="#shop-all"
                    className="inline-flex h-10 md:h-12 items-center rounded-full border border-border bg-surface px-6 text-sm font-medium transition-colors hover:border-gold"
                    >
                    Browse all
                    </a>
                </div>
            </div>

            {featured && (
              <div className="relative select-none">
                <style>{`
                  @keyframes heroCardDropIn {
                    0% {
                      opacity: 0;
                      transform: translate(var(--drop-x), -12px) scale(0.95);
                    }
                    100% {
                      opacity: 1;
                      transform: translate(0, 0) scale(1);
                    }
                  }
                `}</style>

                <div
                  key={featured.id}
                  className="relative block aspect-square w-full overflow-hidden rounded-[2rem] border border-border bg-surface apple-shadow md:aspect-[4/5]"
                  style={{ ...cardDropStyle, ...swipeTransformStyle }}
                  onTouchStart={(e: ReactTouchEvent) => {
                    const t = e.touches[0];
                    handleDragStart(t.clientX, t.clientY);
                  }}
                  onTouchMove={(e: ReactTouchEvent) => {
                    const t = e.touches[0];
                    // Prevent vertical scroll only once horizontal swipe is confirmed
                    if (isHorizontalSwipe.current === true) {
                      e.preventDefault();
                    }
                    handleDragMove(t.clientX, t.clientY);
                  }}
                  onTouchEnd={() => {
                    handleDragEnd();
                  }}
                  onMouseDown={(e: ReactMouseEvent) => {
                    handleDragStart(e.clientX, e.clientY);
                  }}
                  onMouseMove={(e: ReactMouseEvent) => {
                    if (dragStartX.current !== 0) {
                      handleDragMove(e.clientX, e.clientY);
                    }
                  }}
                  onMouseUp={() => {
                    handleDragEnd();
                  }}
                  onMouseLeave={() => {
                    if (dragStartX.current !== 0) {
                      handleDragEnd();
                    }
                  }}
                  onClick={handleCardTap}
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
                </div>

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
          <div className="grid auto-rows-[260px] grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
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
                onClick={() => navigate({ to: "/marketplace", search: { store: s.slug } })}
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
                  onClick={() => fetchNextPage()}
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
