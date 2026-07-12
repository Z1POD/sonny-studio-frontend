// src/features/market/components/ProductCard.tsx

import { Link } from "@tanstack/react-router";
import type { ProductListItem } from "../types";
import { formatPrice } from "@/lib/format";
import { getStockBadge } from "../stock";

// Identifies the parent page so the card can adapt its radius/layout.
type CardPageOrigin = "catalog" | "landing" | "cart-recommendations" | "orders";

interface Props {
  product: ProductListItem;
  size?: "default" | "tall" | "wide";
  /** Identifies the parent page to dynamically change layout styling like border radius */
  page?: CardPageOrigin;
}

export function ProductCard({ product, size = "default", page }: Props) {
  const image = product.mockup_url || product.thumbnail_url;
  const stockBadge = getStockBadge(product);

  // Determine layout size constraints
  const sizeClass =
    size === "tall"
      ? "row-span-2 min-h-[480px]"
      : size === "wide"
        ? "col-span-2 min-h-[280px]"
        : "min-h-[260px]";

  // Dynamically resolve border radius classes based on the page context
  const radiusClass = (() => {
    switch (page) {
      case "catalog":
        return "md:rounded-3xl";
      case "landing":
        return "rounded-2xl md:rounded-3xl";
      default:
        return "rounded-3xl";
    }
  })();

  return (
    <Link
      to="/product/$slug"
      params={{ slug: product.slug }}
      className={`group relative flex flex-col overflow-hidden border border-border bg-surface transition-all duration-500 hover:border-gold hover:apple-shadow ${radiusClass} ${sizeClass}`}
    >
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.04]">
          {image ? (
            <img
              src={image}
              alt={product.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-muted text-sm text-muted-foreground">
              {product.title}
            </div>
          )}
        </div>
        <div className="absolute left-3 top-3 flex flex-col gap-2">
          {product.is_limited_edition && (
            <span className="rounded-full bg-gold px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gold-foreground">
              Limited
            </span>
          )}
        </div>
        <div className="absolute right-3 bottom-3 flex flex-col gap-2">
          {stockBadge && (
            <span
              title={stockBadge.kind === "out" ? "This item is currently out of stock." : undefined}
              className={
                "rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] " +
                (stockBadge.kind === "out"
                  ? "bg-red-600 text-white"
                  : stockBadge.kind === "limited"
                    ? "border border-gold bg-background/20 text-gold backdrop-blur-md"
                    : "bg-foreground text-background")
              }
            >
              {stockBadge.label}
            </span>
          )}
        </div>
      </div>
      <div className="relative z-10 flex items-end justify-between gap-3 border-t border-border bg-background/20 px-5 py-4 backdrop-blur-md">
        <div className="min-w-0 hidden md:block">
          <p className="truncate text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {product.store.name}
          </p>
          <h3 className="mt-0.5 truncate text-base font-semibold tracking-tight">{product.title}</h3>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums">
          {formatPrice(product.retail_price, product.currency)}
        </p>
      </div>
    </Link>
  );
}