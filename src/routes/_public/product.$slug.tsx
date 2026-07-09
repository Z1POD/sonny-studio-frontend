// src/routes/_public/product.$slug.tsx
//
// Product detail page with SEO-optimized meta tags for social sharing.
// Loader pre-fetches product data so head() can generate OG tags before render.

import { createFileRoute } from "@tanstack/react-router";
import { productQuery } from "@/features/market/queries";
import { parseProductSearch } from "@/features/market/lib/productSearch";
import { productHead } from "@/lib/seo";
import { ProductRouteComponent } from "@/features/market/components/ProductRouteComponent";
import { ProductRouteNotFound, ProductRouteError } from "@/features/market/components/ProductRouteStates";

export const Route = createFileRoute("/_public/product/$slug")({
  validateSearch: parseProductSearch,

  // `code`/`ref`/`utm_*` are part of productQuery's cache key (see
  // queries.ts) — loaderDeps makes the loader re-run when they change, and
  // passing `deps` into productQuery below keeps the loader's cache entry
  // identical to the one ProductRouteComponent reads. Without this the
  // loader primes a DIFFERENT entry (no coupon, no attribution), the
  // component cache-misses on mount, and the product view gets tracked
  // twice with the coupon dropped on the first hit.
  loaderDeps: ({ search }) => search,
  loader: ({ context, params, deps }) =>
    context.queryClient.ensureQueryData(productQuery(params.slug, deps)),

  head: ({ loaderData }) => productHead(loaderData),

  notFoundComponent: ProductRouteNotFound,
  errorComponent: ({ error }) => <ProductRouteError error={error as Error} />,

  component: () => <ProductRouteComponent from="/_public/product/$slug" />,
});