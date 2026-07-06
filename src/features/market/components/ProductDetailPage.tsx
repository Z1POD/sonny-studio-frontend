// src/features/market/components/ProductDetailPage.tsx
//
// Marketplace product detail. Image-first (thumbnail/mockups, up to 85vh)
// rather than the 3D-canvas-first layout used for in-studio custom designs —
// per request, this is a finished, ready-to-buy piece, not a live configurator.
//
// A "3D view" toggle sits at the top-right of the hero, opposite the
// "Limited" badge. It's a placeholder for now — flips `is3D` and swaps the
// hero for a stand-in panel — the real 3D viewer plugs in there next.
//
// Data is fetched directly with `useQuery` (no route loader/prefetch) to
// match the CatalogPage pattern. "Add to bag" uses the marketplace's own
// cart store (`../store`).
"use client";

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Box, Check, Image as ImageIcon, Loader2, ShoppingBag, Star } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useCart } from "../store";
import { formatPrice } from "@/lib/format";
import type { ProductDetail } from "../api";
import { productQuery } from "../queries";
import { ProductCard } from "./ProductCard";

export function ProductDetailPage({ slug }: { slug: string }) {
  const { data: product, isLoading, isError } = useQuery(productQuery(slug));
  const addToCart = useCart((s) => s.add);
  const openCart = useCart((s) => s.openDrawer);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-lg font-semibold">Product not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This piece may have been removed or is no longer available.
        </p>
        <Link
          to="/marketplace"
          className="mt-6 inline-flex h-11 items-center rounded-full border border-border bg-surface px-6 text-sm font-medium hover:border-gold"
        >
          Back to marketplace
        </Link>
      </div>
    );
  }

  return <ProductDetailContent product={product} addToCart={addToCart} openCart={openCart} />;
}

function ProductDetailContent({
  product,
  addToCart,
  openCart,
}: {
  product: ProductDetail;
  addToCart: ReturnType<typeof useCart.getState>["add"];
  openCart: () => void;
}) {
  const [colorName, setColorName] = useState(product.variants.colors[0]?.name ?? "");
  const color = useMemo(
    () => product.variants.colors.find((c) => c.name === colorName) ?? product.variants.colors[0],
    [product.variants.colors, colorName],
  );
  const [size, setSize] = useState(color?.sizes[0] ?? product.variants.sizes[0] ?? "M");
  const [activeImage, setActiveImage] = useState(0);
  const [isAdded, setIsAdded] = useState(false);
  // Placeholder toggle — swaps the hero to a 3D viewer stand-in. Wired up to
  // the real viewer once `product.viewer_3d` has a concrete shape.
  const [is3D, setIs3D] = useState(false);

  const gallery = product.mockups.length > 0 ? product.mockups.map((m) => m.url) : [product.thumbnail_url];
  const unitPrice = color?.prices?.[size] ?? product.pricing.retail_price;

  const onPickColor = (name: string) => {
    setColorName(name);
    const v = product.variants.colors.find((c) => c.name === name);
    if (v && !v.sizes.includes(size)) setSize(v.sizes[0] ?? size);
  };

  const onAdd = () => {
    if (!color) return;
    addToCart(product, color, size, 1);
    toast.success("Added to bag", {
      description: `${product.title} · ${color.name} · ${size}`,
      action: { label: "View", onClick: () => openCart() },
    });
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  return (
    <div className="relative pb-28 md:pb-16">
        <div className="mx-auto grid max-w-7xl gap-6 px-1 md:px-4 pb:4 md:pb-32 md:grid-cols-[1.2fr_1fr] md:gap-12 md:px-8 md:pb-16 md:pt-4">
            {/* Fullscreen thumbnail hero — up to 85vh per spec */}
            <div className="relative h-[85vh] max-h-[900px] w-full overflow-hidden bg-surface md:mx-auto md:max-w-5xl rounded-2xl md:rounded-[2rem] md:border md:border-border">
                {is3D ? (
                // Stand-in for the 3D viewer — swap this panel for the real canvas.
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-muted/30 text-muted-foreground">
                    <Box className="h-8 w-8" />
                    <p className="text-sm">3D preview coming soon</p>
                </div>
                ) : (
                <img src={gallery[activeImage]} alt={product.title} className="h-full w-full object-cover" />
                )}

                {product.is_limited_edition && (
                <span className="absolute left-4 top-4 rounded-full bg-gold px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gold-foreground">
                    Limited
                </span>
                )}

                {/* 3D / photo toggle — top-right corner of the hero */}
                <button
                onClick={() => setIs3D((v) => !v)}
                className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-[11px] font-medium text-foreground backdrop-blur transition hover:border-gold"
                >
                {is3D ? (
                    <>
                    <ImageIcon className="h-3.5 w-3.5" /> Photo
                    </>
                ) : (
                    <>
                    <Box className="h-3.5 w-3.5" /> 3D view
                    </>
                )}
                </button>

                {!is3D && gallery.length > 1 && (
                <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
                    {gallery.map((_, i) => (
                    <button
                        key={i}
                        onClick={() => setActiveImage(i)}
                        aria-label={`Image ${i + 1}`}
                        className={`h-1.5 rounded-full transition-all ${
                        i === activeImage ? "w-6 bg-foreground" : "w-1.5 bg-foreground/30"
                        }`}
                    />
                    ))}
                </div>
                )}
            </div>

            <div className="mx-auto max-w-3xl px-4 pt-6 md:px-8">
                <Link
                to="/marketplace"
                search={{ store: product.store.slug }}
                className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-gold"
                >
                {product.store.name}
                </Link>
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{product.title}</h1>

                {product.reviews_summary.total_reviews > 0 && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                    <div className="flex items-center gap-1 text-gold">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    <span className="font-medium">{product.reviews_summary.average_rating.toFixed(1)}</span>
                    </div>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{product.reviews_summary.total_reviews} reviews</span>
                </div>
                )}

                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{product.description}</p>

                {product.variants.colors.length > 1 && (
                <section className="mt-6">
                    <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Color — <span className="text-foreground">{colorName}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                    {product.variants.colors.map((v) => (
                        <button
                        key={v.name}
                        title={v.name}
                        onClick={() => onPickColor(v.name)}
                        className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                            colorName === v.name ? "border-foreground scale-110" : "border-transparent"
                        }`}
                        style={{ background: v.hex }}
                        />
                    ))}
                    </div>
                </section>
                )}

                {(color?.sizes ?? product.variants.sizes).length > 0 && (
                <section className="mt-6">
                    <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Size — <span className="text-foreground">{size}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                    {(color?.sizes ?? product.variants.sizes).map((s) => (
                        <button
                        key={s}
                        onClick={() => setSize(s)}
                        className={`h-10 min-w-[2.5rem] rounded-xl border px-3 text-sm font-medium transition-colors ${
                            size === s
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-surface text-muted-foreground hover:border-foreground/40"
                        }`}
                        >
                        {s}
                        </button>
                    ))}
                    </div>
                </section>
                )}

                {!is3D && gallery.length > 1 && (
                <section className="mt-6">
                    <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Gallery</p>
                    <div className="grid grid-cols-3 gap-2">
                    {gallery.map((url, i) => (
                        <button
                        key={i}
                        onClick={() => setActiveImage(i)}
                        className={`aspect-square overflow-hidden rounded-xl border ${
                            i === activeImage ? "border-foreground" : "border-border"
                        }`}
                        >
                        <img src={url} alt="" className="h-full w-full object-cover" />
                        </button>
                    ))}
                    </div>
                </section>
                )}

            </div>
        </div>
        <ProductDetailsTable product={product} />

      {product.related_products.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-8 pt-10 md:px-8">
          <h2 className="mb-5 text-xl font-semibold tracking-tight">You might also like</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 md:gap-4">
            {product.related_products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Fixed price + place-order / add-to-bag CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 backdrop-blur md:sticky md:mx-auto md:mt-8 md:max-w-3xl md:rounded-2xl md:border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Total</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums">
              {formatPrice(unitPrice, product.pricing.currency)}
            </p>
          </div>
          <button
            onClick={onAdd}
            disabled={!color || isAdded}
            className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl font-semibold transition-all duration-300 active:scale-[0.98] disabled:opacity-50 md:flex-none md:px-8 ${
              isAdded ? "bg-green-600 text-white" : "bg-gold text-gold-foreground"
            }`}
          >
            {isAdded ? (
              <>
                <Check className="h-4 w-4" /> Added!
              </>
            ) : (
              <>
                <ShoppingBag className="h-4 w-4" /> Add to bag
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductDetailsTable({ product }: { product: ProductDetail }) {
  const info = product.apparel_info;
  const rows: { label: string; value: string }[] = [];
  if (info?.name) rows.push({ label: "Style", value: info.name });
  if (info?.brand) rows.push({ label: "Brand", value: info.brand });
  if (info?.fit) rows.push({ label: "Fit", value: info.fit });
  if (info?.weight_grams) rows.push({ label: "Fabric weight", value: `${info.weight_grams} g` });
  if (product.is_limited_edition && product.available_quantity != null) {
    rows.push({ label: "Available", value: `${product.available_quantity} in stock` });
  }
  if (product.max_quantity != null) {
    rows.push({ label: "Max per order", value: String(product.max_quantity) });
  }

  if (rows.length === 0 && product.tags.length === 0) return null;

  return (
    <section className="mt-8 mx-auto max-w-[90vw] border-t border-border pt-8">
      <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Details</p>
      {rows.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface/40">
          <Table>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="w-[40%] text-muted-foreground">{row.label}</TableCell>
                  <TableCell className="font-medium text-foreground">{row.value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {product.tags.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {product.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border bg-background/40 px-3 py-1 text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}