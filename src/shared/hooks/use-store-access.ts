// src/shared/hooks/use-store-access.ts  (CREATOR APP)
import { useAuthStore } from "@/features/auth/store";

/**
 * Whether the signed-in user may price and publish designs.
 *
 * In the split architecture every account is a buyer by default and the
 * backend adds a creator/designer MEMBERSHIP automatically when someone uses
 * this app — there is no role switching in the frontend any more. So access
 * only requires a signed-in user; the one remaining gate is an explicit
 * `is_verified === false` coming from the backend (store/KYC verification).
 *
 * Name kept (`useHasVerifiedStore`) so existing call sites keep working.
 * The field is `user.creator_profile.is_verified` (shared user contract); this is the single place that reads it.
 */
export function useHasVerifiedStore(): boolean {
  const user = useAuthStore((s) => s.user);
  return Boolean(user) && user?.creator_profile?.is_verified !== false;
}
