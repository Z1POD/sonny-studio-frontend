// src/features/market/components/ProductRouteStates.tsx
//
// Shared notFound/error UI for the two product-detail route aliases
// (/p/$slug and /product/$slug). Pulled out so the two route files can't
// drift out of sync with each other over time.

export function ProductRouteNotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Piece not found</h2>
        <a href="/marketplace" className="mt-4 inline-block text-sm text-gold">
          Back to marketplace
        </a>
      </div>
    </div>
  );
}

export function ProductRouteError({ error }: { error: Error }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center text-sm text-muted-foreground">
      {error.message}
    </div>
  );
}