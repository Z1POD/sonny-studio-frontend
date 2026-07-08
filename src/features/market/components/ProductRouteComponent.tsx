// src/features/market/components/ProductRouteComponent.tsx
//
// Both /p/$slug and /product/$slug render identically — only the route id
// differs. `useParams`/`useSearch` accept a `from` route id outside the
// route file itself, so this one component can back both aliases instead
// of two copies of the same JSX.

import { useParams, useSearch } from "@tanstack/react-router";
import { ProductDetailPage } from "./ProductDetailPage";

const PRODUCT_ROUTE_IDS = [
  "/_authenticated/product/$slug",
  "/_authenticated/p/$slug",
] as const;

type ProductRouteId = (typeof PRODUCT_ROUTE_IDS)[number];

export function ProductRouteComponent({ from }: { from: ProductRouteId }) {
  const { slug } = useParams({ from });
  const attribution = useSearch({ from });
  return <ProductDetailPage slug={slug} attribution={attribution} />;
}