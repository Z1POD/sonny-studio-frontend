// src/features/market/components/ProductRouteComponent.tsx

import { useParams, useSearch } from "@tanstack/react-router";
import { ProductDetailPage } from "./ProductDetailPage";

const PRODUCT_ROUTE_IDS = [
  "/_public/product/$slug",
  "/_public/p/$slug",
] as const;

type ProductRouteId = (typeof PRODUCT_ROUTE_IDS)[number];

export function ProductRouteComponent({ from }: { from: ProductRouteId }) {
  const { slug } = useParams({ from });
  const attribution = useSearch({ from });
  return <ProductDetailPage slug={slug} attribution={attribution} />;
}