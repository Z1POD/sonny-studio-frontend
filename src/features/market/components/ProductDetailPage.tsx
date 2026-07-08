// src/features/market/components/ProductDetailPage.tsx

"use client";

import { useMemo, useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Box, Check, Eye, Image as ImageIcon, Loader2, ShoppingBag, Star } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useCart } from "../store";
import { formatPrice } from "@/lib/format";
import type { ProductDetail } from "../api";
import { productQuery } from "../queries";
import { ProductCard } from "./ProductCard";
import { ApparelCanvas } from "./viewer/ApparelCanvas";
import { BrandLoader } from "@/components/ui/loader";
import { CanvasErrorBoundary } from "@/features/studio/components/CanvasErrorBoundary";

export function ProductDetailPage({ slug }: { slug: string }) {
  const { data: product, isLoading, isError } = useQuery(productQuery(slug));
  const addToCart = useCart((s) => s.add);
  const openCart = useCart((s) => s.openDrawer);

  if (isLoading) {
    return (
      <div className="flex h-[60dvh] items-center justify-center">
        <BrandLoader size="md" />
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
  const [imageDirection, setImageDirection] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  // 3D / photo toggle. Only offered when the product actually ships a
  // rigged GLB (`viewer_3d.model_url`) — otherwise the button never renders.
  const [is3D, setIs3D] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(true);
  const has3D = !!product.viewer_3d?.model_url;

  // Re-arm the loading overlay every time the 3D view is (re-)opened, since
  // the Canvas unmounts/remounts with it.
  useEffect(() => {
    if (is3D) setViewerLoading(true);
  }, [is3D]);

  const gallery = product.mockups.length > 0 ? product.mockups.map((m) => m.url) : [product.thumbnail_url];
  const unitPrice = color?.prices?.[size] ?? product.pricing.retail_price;

  const goToImage = (index: number) => {
    if (index < 0 || index >= gallery.length || index === activeImage) return;
    setImageDirection(index > activeImage ? 1 : -1);
    setActiveImage(index);
  };

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
    <div className="relative pb-28 md:pb-0">
        <div className="mx-auto grid max-w-7xl gap-6 px-1 md:px-4 pb:4 md:grid-cols-[1.2fr_1fr] md:gap-12 md:px-8 pt-8 md:pt-4 md:mt-12">
            {/* Fullscreen thumbnail hero — up to 85vh per spec */}
            <div className="relative h-[85dvh] max-h-[900px] w-full overflow-hidden bg-surface md:mx-auto md:max-w-5xl rounded-2xl md:rounded-[2rem] md:border md:border-border">
                {is3D && has3D && product.viewer_3d ? (
                  <CanvasErrorBoundary>
                    <div className="relative h-full w-full">
                        <ApparelCanvas
                        color={color ?? product.variants.colors[0]}
                        viewer={product.viewer_3d}
                        onLoadingChange={(loading) => setViewerLoading(loading)}
                        onError={() => {
                            setIs3D(false);
                            toast.error("showing photos instead");
                        }}
                        />

                        {viewerLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/60 backdrop-blur-sm">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">Loading 3D preview…</p>
                        </div>
                        )}

                        {/* Floating color picker — only once the model has fully loaded */}
                        {!viewerLoading && product.variants.colors.length > 1 && (
                        <div className="absolute inset-x-0 bottom-4 flex justify-center">
                            <div className="flex items-center gap-2 rounded-full border border-white/20 bg-background/60 px-3 py-2 shadow-lg backdrop-blur-2xl">
                            {product.variants.colors.map((v) => (
                                <button
                                key={v.name}
                                title={v.name}
                                onClick={() => onPickColor(v.name)}
                                className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                                    colorName === v.name ? "border-foreground scale-110" : "border-white/40"
                                }`}
                                style={{ background: v.hex }}
                                />
                            ))}
                            </div>
                        </div>
                        )}
                    </div>
                  </CanvasErrorBoundary>
                ) : (
                <div className="relative h-full w-full overflow-hidden">
                    <AnimatePresence initial={false} custom={imageDirection} mode="popLayout">
                    <motion.img
                        key={activeImage}
                        src={gallery[activeImage]}
                        alt={product.title}
                        custom={imageDirection}
                        variants={{
                        enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
                        center: { x: 0, opacity: 1 },
                        exit: (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
                        }}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 300, damping: 32 }}
                        drag={gallery.length > 1 ? "x" : false}
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.6}
                        onDragEnd={(_, info) => {
                        const threshold = 60;
                        if (info.offset.x < -threshold) goToImage(activeImage + 1);
                        else if (info.offset.x > threshold) goToImage(activeImage - 1);
                        }}
                        className="absolute inset-0 h-full w-full object-cover cursor-grab active:cursor-grabbing"
                    />
                    </AnimatePresence>
                </div>
                )}

                {product.is_limited_edition && (
                <span className="absolute left-4 top-4 rounded-full bg-gold px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gold-foreground">
                    Limited
                </span>
                )}

                {has3D && (
                <button
                onClick={() => setIs3D((v) => !v)}
                className="absolute right-4 bottom-4 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-[11px] font-medium text-foreground backdrop-blur transition hover:border-gold"
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
                )}

                {!is3D && gallery.length > 1 && (
                <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
                    {gallery.map((_, i) => (
                    <button
                        key={i}
                        onClick={() => goToImage(i)}
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
                    <span className="text-muted-foreground">·</span>
                </div>
                )}
                <div className="flex items-center gap-1 text-muted-foreground">
                    <Eye className="h-3.5 w-3.5"/>
                    <span className="text-muted-foreground">{product.stats.view_count}</span>
                </div>
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

                {gallery.length > 1 && (
                <section className="mt-6">
                    <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Gallery</p>
                    <div className="grid grid-cols-3 gap-2">
                    {gallery.map((url, i) => (
                        <button
                        key={i}
                        onClick={() => goToImage(i)}
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

                <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 backdrop-blur md:static md:z-auto md:mt-8 md:rounded-2xl md:border md:px-6 md:py-5 md:pb-5 md:backdrop-blur-none">
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
                                isAdded ? "bg-[#083b32]/80 text-white" : "bg-gold text-gold-foreground"
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
    <section className="mt-8 px-2 max-w-2xl border-t border-border pt-8">
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