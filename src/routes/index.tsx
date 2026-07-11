import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getStoredToken } from "@/shared/api/client";
import { useTelegram } from "@/shared/hooks/use-telegram";
import { SplashPage } from "@/features/auth/components/SplashPage";

export const Route = createFileRoute("/")({
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
  const navigate = useNavigate();
  const { isTelegram } = useTelegram();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  useEffect(() => {
    if (!mounted || isTelegram) return;
    if (getStoredToken()) {
      navigate({ to: "/marketplace", replace: true });
    }
  }, [mounted, isTelegram, navigate]);

  return <SplashPage isTelegramLaunching={mounted && isTelegram} />;
}