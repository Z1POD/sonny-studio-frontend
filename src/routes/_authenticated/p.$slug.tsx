// src/routes/_authenticated/p.$slug.tsx
import { createFileRoute } from "@tanstack/react-router";
import { ProductDetailPage } from "@/features/market/components/ProductDetailPage";
import { parseProductSearch } from "@/features/market/lib/productSearch";

export const Route = createFileRoute("/_authenticated/p/$slug")({
  validateSearch: parseProductSearch,
  component: ProductRoute,
});

function ProductRoute() {
  const { slug } = Route.useParams();
  const attribution = Route.useSearch();
  return <ProductDetailPage slug={slug} attribution={attribution} />;
}