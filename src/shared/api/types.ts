/** Shared API DTOs — mirror the Buyer Frontend API contract. */

export interface Currency {
  code: string;
  symbol: string;
  name?: string;
  /** Fraction digits to render (contract: `decimal_places` / `currency_decimal_places`). */
  decimal_places?: number;
}

/** `user` object returned by login and `GET /accounts/me/`. */
export interface RawUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  locale: string;
  preferred_currency: { id: string; code: string; symbol: string; decimal_places: number } | null;
  /** Public URL of the avatar (the backend copies it from the Telegram profile); null when none. */
  avatar_url: string | null;
  /** How the user last signed in. Display-only — never gate behaviour on it. Read-only. */
  auth_method: "telegram" | "otp" | "password" | "admin" | "";
  last_active_at: string | null;
  notify_telegram: boolean;
  notify_email: boolean;
  roles: string[];
  /**
   * Creator-side profile, present once the account has used the creator app (the backend adds the membership).
   * `is_verified: false` means pricing/publishing is blocked (store/KYC review); absent or true = allowed.
   */
  creator_profile?: { is_verified: boolean; store_name?: string | null } | null;
  telegram_identity?: {
    telegram_id: number;
    telegram_username: string;
    language_code: string;
    photo_url?: string;
    is_premium: boolean;
  } | null;
  is_active: boolean;
  date_joined: string;
  updated_at: string;
}

/** App-level user: the raw contract fields plus a derived display name. */
export interface User extends RawUser {
  display_name: string;
  /** Best available avatar: the stored avatar, else the Telegram photo. Undefined → show initials. */
  photo_url?: string;
}

export function toUser(raw: RawUser): User {
  const full = [raw.first_name, raw.last_name].filter(Boolean).join(" ").trim();
  return {
    ...raw,
    display_name: full || raw.telegram_identity?.telegram_username || raw.username,
    ...(raw.avatar_url || raw.telegram_identity?.photo_url
      ? { photo_url: (raw.avatar_url || raw.telegram_identity?.photo_url) as string }
      : {}),
  };
}

export interface AuthTokenResponse {
  token: string;
  user: RawUser;
}
