// src/shared/hooks/use-store-access.ts
import { useAuthStore } from "@/features/auth/store";

/**
 * Store / Wallet / Analytics are creator-only surfaces, and only make sense
 * once the creator's store has passed verification.
 *
 * `User` (see `shared/api/types.ts`) currently exposes `is_creator` and
 * `is_verified` as the closest proxies for "has a verified store". If the
 * backend later adds a dedicated field (e.g. `user.store.is_verified`),
 * swap the check below to that — this is the single place it's gated.
 */
export function useHasVerifiedStore(): boolean {
  const user = useAuthStore((s) => s.user);
  return Boolean(user?.is_creator && user?.is_verified);
}