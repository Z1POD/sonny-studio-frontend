import { createFileRoute, redirect } from "@tanstack/react-router";
import { getStoredToken } from "@/shared/api/client";
import { useTelegramAutoLogin } from "@/features/auth/hooks/useTelegramAutoLogin";
import { SplashPage } from "@/features/auth/components/SplashPage";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (getStoredToken()) throw redirect({ to: "/marketplace" });
  },
  head: () => ({
    meta: [
      { title: "Sonny — Design Studio" },
      {
        name: "description",
        content:
          "Sonny is a creator studio for designing and selling custom apparel.",
      },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  const { tgLoading } = useTelegramAutoLogin({ redirectTo: "/marketplace" });
  return <SplashPage isSigningIn={tgLoading} />;
}