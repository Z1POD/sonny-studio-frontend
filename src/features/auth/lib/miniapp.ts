// src/features/auth/lib/miniapp.ts

/**
 * Resolves the Telegram Mini App handle/URL from VITE_MINIAPP_HANDLE.
 * (Earlier drafts had a typo'd env var name, and the reference AuthSheet.tsx
 * read it via `process.env`, which doesn't exist in a Vite browser bundle.
 * Both are fixed here: single source of truth via `import.meta.env`.)
 */
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

/**
 * Resolves a link to send the user to the Telegram bot/Mini App. Prefers a
 * server-provided signup_link (e.g. from a NOT_FOUND OTP error), falling
 * back to the configured handle.
 */
export function getTelegramLink(details?: Record<string, string>): string | null {
  if (details?.signup_link) return details.signup_link;
  return getMiniAppUrl();
}