import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginCard } from "@/features/auth/components/LoginCard";
import { getStoredToken } from "@/shared/api/client";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (getStoredToken()) {
      throw redirect({ to: search.redirect || "/store" });
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
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 safe-top safe-bottom">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse at 20% 30%, oklch(0.68 0.18 254 / 0.12), transparent 50%), radial-gradient(ellipse at 80% 70%, oklch(0.56 0.18 296 / 0.10), transparent 55%)",
        }}
      />
      <LoginCard />
    </div>
  );
}
