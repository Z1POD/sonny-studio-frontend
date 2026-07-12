// src/features/market/stock.ts

const LOW_STOCK_THRESHOLD = 6;

export interface StockLike {
  is_limited_edition: boolean;
  available_quantity: number | null | undefined;
}

export type StockBadge =
  | { kind: "out"; label: string }
  | { kind: "limited"; label: string }
  | { kind: "low"; label: string }
  | null;

export function isOutOfStock(product: StockLike): boolean {
  return product.available_quantity != null && product.available_quantity < 1;
}

export function getStockBadge(product: StockLike): StockBadge {
  const qty = product.available_quantity;

  if (isOutOfStock(product)) {
    return { kind: "out", label: "Sold Out" };
  }

  if (product.is_limited_edition && qty != null && qty < 10) {
    return { kind: "limited", label: `${qty}` };
  }

  if (!product.is_limited_edition && qty != null && qty < LOW_STOCK_THRESHOLD) {
    return { kind: "low", label: `${qty}` };
  }

  return null;
}

export const OUT_OF_STOCK_MESSAGE = "This item is currently out of stock.";