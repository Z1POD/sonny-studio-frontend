import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginCard } from "@/features/auth/components/LoginCard";
import { getStoredToken } from "@/shared/api/client";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (getStoredToken()) {
      throw redirect({ to: search.redirect || "/catalog" });
    }
  },
  head: () => ({
    meta: [
      { title: "Sign in — Sonny" },
      {
        name: "description",
        content: "Sign in to your Sonny design studio account.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[oklch(0.08_0.02_280)] px-4 safe-top safe-bottom">
      {/* Subtle ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 30% 45%, oklch(0.45 0.18 280 / 0.2), transparent 60%), radial-gradient(ellipse 40% 35% at 70% 55%, oklch(0.4 0.16 320 / 0.15), transparent 55%)",
        }}
      />
      <LoginCard />
    </div>
  );
}
