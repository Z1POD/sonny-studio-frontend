// src/routes/_authenticated/marketplace.tsx
import { createFileRoute } from "@tanstack/react-router";
import { MarketplacePage } from "@/features/market/components/MarketplacePage";

export const Route = createFileRoute("/_authenticated/marketplace")({
  component: MarketplacePage,
});