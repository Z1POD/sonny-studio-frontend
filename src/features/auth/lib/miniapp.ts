// src/features/auth/lib/miniapp.ts

const env =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: Record<string, string | undefined> }).env) ||
  {};

export const MINIAPP_HANDLE: string | null = env.VITE_MINIAPP_HANDLE || null;

/** Full https://t.me/... URL, whether the env var holds a bare handle or a full URL. */
export function getMiniAppUrl(): string | null {
  if (!MINIAPP_HANDLE) return null;
  return MINIAPP_HANDLE.startsWith("http")
    ? MINIAPP_HANDLE
    : `https://t.me/${MINIAPP_HANDLE.replace(/^@/, "")}`;
}

export function getTelegramLink(details?: Record<string, string>): string | null {
  if (details?.signup_link) return details.signup_link;
  return getMiniAppUrl();
}