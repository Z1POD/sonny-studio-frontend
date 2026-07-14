// src/features/auth/api.ts


/**
 * Auth feature — thin API wrappers around the external M I M O backend.
 * Supports OTP-based auth (browser) and Telegram Mini App init data exchange.
 *
 * All endpoints that return AuthTokenResponse unwrap `.data` so callers
 * always receive { token, user } directly.
 */
import { api } from "@/shared/api/client";
import type { AuthTokenResponse, User } from "@/shared/api/types";

export const authApi = {
  requestOtp: (username: string) =>
    api.post<{ detail: string }>("/auth/otp/request/", {
      body: { username },
      auth: false,
    }),

  verifyOtp: (username: string, code: string) =>
    api
      .post<AuthTokenResponse>("/auth/otp/verify/", {
        body: { username, code },
        auth: false,
      })
      .then((res) => res.data),

  loginTelegram: (initData: string) =>
    api
      .post<AuthTokenResponse>("/auth/telegram/", {
        auth: false,
        headers: { "X-Telegram-Init-Data": initData },
      })
      .then((res) => res.data),

  logout: () => api.post<void>("/auth/logout/").catch(() => undefined),

  me: () =>
    api
      .get<{ success: boolean; data: User } | User>("/users/me/")
      .then((res) => {
        // Handle both wrapped `{ success, data: User }` and bare `User` shapes.
        if (res && typeof res === "object" && "data" in res && "success" in res) {
          return (res as { success: boolean; data: User }).data;
        }
        return res as User;
      }),
};