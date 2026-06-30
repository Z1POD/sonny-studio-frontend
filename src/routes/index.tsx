import { createFileRoute, redirect } from "@tanstack/react-router";
import { getStoredToken } from "@/shared/api/client";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // Send to designs if signed in, login otherwise.
    if (getStoredToken()) throw redirect({ to: "/designs" });
    throw redirect({ to: "/login" });
  },
});
