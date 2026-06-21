import { createFileRoute, redirect } from "@tanstack/react-router";
import { getStoredToken } from "@/shared/api/client";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // Send to store if signed in, login otherwise.
    if (getStoredToken()) throw redirect({ to: "/store" });
    throw redirect({ to: "/login" });
  },
});
