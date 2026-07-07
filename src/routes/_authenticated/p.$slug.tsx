// src/routes/_authenticated/p.$slug.tsx
import { createFileRoute } from "@tanstack/react-router";
import { ProductDetailPage } from "@/features/market/components/ProductDetailPage";

export const Route = createFileRoute("/_authenticated/p/$slug")({
  component: ProductRoute,
});

function ProductRoute() {
  const { slug } = Route.useParams();
  return <ProductDetailPage slug={slug} />;
}