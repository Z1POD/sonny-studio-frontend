// src/routes/_public/p.$slug.tsx
//
// Short-URL alias: /p/:slug → same product detail page as /product/:slug
// The route is a thin shell; all data-fetching and rendering live in
// the shared ProductDetailPage component.

import { createFileRoute } from "@tanstack/react-router";
import { productQuery } from "@/features/market/queries";
import { parseProductSearch } from "@/features/market/lib/productSearch";
import { productHead } from "@/lib/seo";
import { ProductRouteComponent } from "@/features/market/components/ProductRouteComponent";
import { ProductRouteNotFound, ProductRouteError } from "@/features/market/components/ProductRouteStates";

export const Route = createFileRoute("/_public/p/$slug")({
  validateSearch: parseProductSearch,

  // See product.$slug.tsx — loaderDeps keeps this in sync with the
  // component's query cache entry so coupon/ref/utm aren't dropped and the
  // view isn't tracked twice on first mount.
  loaderDeps: ({ search }) => search,
  loader: ({ context, params, deps }) =>
    context.queryClient.ensureQueryData(productQuery(params.slug, deps)),

  head: ({ loaderData }) => productHead(loaderData),

  notFoundComponent: ProductRouteNotFound,
  errorComponent: ({ error }) => <ProductRouteError error={error as Error} />,

  component: () => <ProductRouteComponent from="/_public/p/$slug" />,
});