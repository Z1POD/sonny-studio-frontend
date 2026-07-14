/**
 * src/lib/seo.ts
 *
 * SEO meta tag generators for dynamic pages.
 * Used by route head() functions to generate OG/Twitter/meta tags from loader data.
 */

import type { ProductDetail } from "@/features/market/api";

// Product Detail Page SEO

interface ProductHeadMeta {
  title: string;
  description: string;
  image?: string;
  price?: string;
  currency?: string;
  slug?: string;
}

export function productHead(loaderData: unknown) {
  const p = loaderData as ProductDetail | undefined;

  const title = p?.title ? `${p.title} — M I M O` : "Product — M I M O";
  const description = p?.description ?? "Configure this piece in 3D. Quietly luxurious.";
  const image = p?.thumbnail_url;
  const price = p?.pricing?.retail_price;
  const currencySym =
    typeof p?.pricing?.currency === "object"
      ? p?.pricing?.currency?.symbol
      : "$";

  const meta: Array<
    | { title: string }
    | { name: string; content: string }
    | { property: string; content: string }
  > = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "product" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];

  if (image) {
    meta.push({ property: "og:image", content: image });
    meta.push({ name: "twitter:image", content: image });
  }

  if (price) {
    meta.push({ property: "product:price:amount", content: price });
    meta.push({ property: "product:price:currency", content: currencySym ?? "USD" });
  }

  return { meta };
}
