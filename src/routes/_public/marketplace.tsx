// src/routes/_public/marketplace.tsx

import { createFileRoute } from "@tanstack/react-router";
import { MarketplacePage } from "@/features/market/components/MarketplacePage";

export const Route = createFileRoute("/_public/marketplace")({
  component: MarketplacePage,
});