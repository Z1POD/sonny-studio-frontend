// src/routes/_authenticated/product.$slug.tsx
import { createFileRoute } from "@tanstack/react-router";
import { ProductDetailPage } from "@/features/market/components/ProductDetailPage";
import { parseProductSearch } from "@/features/market/lib/productSearch";

export const Route = createFileRoute("/_authenticated/product/$slug")({
  validateSearch: parseProductSearch,
  component: ProductRoute,
});

function ProductRoute() {
  const { slug } = Route.useParams();
  const attribution = Route.useSearch();
  return <ProductDetailPage slug={slug} attribution={attribution} />;
}