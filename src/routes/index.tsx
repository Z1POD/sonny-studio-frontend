import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getStoredToken } from "@/shared/api/client";
import { useTelegram } from "@/shared/hooks/use-telegram";
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
  const { isTelegram } = useTelegram();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return <SplashPage isTelegramLaunching={mounted && isTelegram} />;
}