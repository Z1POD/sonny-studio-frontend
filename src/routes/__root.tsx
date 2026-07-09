import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";

import { useTelegram } from "@/shared/hooks/use-telegram";
import { useTelegramLaunch } from "@/features/auth/hooks/useTelegramLaunch";
import { OverlayRoot } from "@/shared/components/overlay/OverlayRoot";
import { NotFoundPage } from "@/shared/components/NotFoundPage";
import { ErrorPage } from "@/shared/components/ErrorPage";
import appCss from "../styles.css?url";

// Environment-derived config (only what changes per environment)

const APP_URL = import.meta.env.VITE_APP_URL ?? "https://google.com";
const MINIAPP_HANDLE = import.meta.env.VITE_MINIAPP_HANDLE ?? "BotFather";

const OG_IMAGE = `${APP_URL}/og-image.jpg`;

// SEO & Meta

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      // Charset & viewport
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },

      // Primary
      { title: "Sonny Studio — Customized Apparel" },
      {
        name: "description",
        content:
          "Design and sell premium custom apparel in 3D. A quiet, luxurious creator studio for fashion entrepreneurs.",
      },
      { name: "theme-color", content: "#000000" },
      { name: "color-scheme", content: "dark light" },

      // Robots
      { name: "robots", content: "index, follow, max-image-preview:large" },

      // Open Graph
      { property: "og:title", content: "Sonny Studio — Customized Apparel" },
      {
        property: "og:description",
        content: "Configure premium apparel in 3D. Quietly luxurious.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: APP_URL },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:site_name", content: "Sonny Studio" },
      { property: "og:locale", content: "en_US" },

      // Twitter
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Sonny Studioapp" },
      { name: "twitter:title", content: "Sonny Studio — Customized Apparel" },
      {
        name: "twitter:description",
        content: "Configure premium apparel in 3D. Quietly luxurious.",
      },
      { name: "twitter:image", content: OG_IMAGE },

      // Apple / iOS
      { name: "apple-mobile-web-app-capable", content: "yes" },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black-translucent",
      },
      { name: "apple-mobile-web-app-title", content: "Sonny Studio" },
      { name: "format-detection", content: "telephone=no" },

      // Microsoft
      { name: "msapplication-TileColor", content: "#000000" },
      { name: "msapplication-config", content: "/browserconfig.xml" },

      // Telegram
      { name: "telegram:bot", content: `@${MINIAPP_HANDLE}` },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://telegram.org" },
      { rel: "canonical", href: APP_URL },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
    scripts: [
      { src: "https://telegram.org/js/telegram-web-app.js" },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Zonic",
          description:
            "Design and sell premium custom apparel in 3D. A quiet, luxurious creator studio for fashion entrepreneurs.",
          url: APP_URL,
          applicationCategory: "DesignApplication",
          operatingSystem: "Any",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "ETB",
          },
          author: {
            "@type": "Organization",
            name: "Sonny Studio",
            url: APP_URL,
          },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => <NotFoundPage />,
  errorComponent: ({ error, reset }) => <ErrorPage error={error} reset={reset} />,
});

// Shell

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

// Root Component

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useTelegram();
  useTelegramLaunch();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <OverlayRoot />
      <Toaster position="bottom-center" theme="system" offset="52px" />
    </QueryClientProvider>
  );
}