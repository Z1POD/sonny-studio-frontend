// src/routes/_public/p.$slug.tsx

import { createFileRoute } from "@tanstack/react-router";
import { productQuery } from "@/features/market/queries";
import { parseProductSearch } from "@/features/market/lib/productSearch";
import { productHead } from "@/lib/seo";
import { ProductRouteComponent } from "@/features/market/components/ProductRouteComponent";
import { ProductRouteNotFound, ProductRouteError } from "@/features/market/components/ProductRouteStates";

export const Route = createFileRoute("/_public/p/$slug")({
  validateSearch: parseProductSearch,


  loaderDeps: ({ search }) => search,
  loader: ({ context, params, deps }) =>
    context.queryClient.ensureQueryData(productQuery(params.slug, deps)),

  head: ({ loaderData }) => productHead(loaderData),

  notFoundComponent: ProductRouteNotFound,
  errorComponent: ({ error }) => <ProductRouteError error={error as Error} />,

  component: () => <ProductRouteComponent from="/_public/p/$slug" />,
});