// src/features/auth/api.ts
//
// Auth for the Buyer Frontend API. The only login the contract defines is the
// Telegram Mini App exchange: the signed `initData` goes in the Authorization
// header (`Bearer <initData>`), the body is empty.

import { api } from "@/shared/api/client";
import { toUser, type AuthTokenResponse, type RawUser, type User } from "@/shared/api/types";

export const authApi = {
  loginTelegram: (initData: string): Promise<{ token: string; user: User }> =>
    api
      .post<AuthTokenResponse>("/accounts/auth/telegram/", {
        body: {},
        auth: false,
        headers: { Authorization: `Bearer ${initData}` },
      })
      .then((res) => ({ token: res.token, user: toUser(res.user) })),

  /**
   * Browser sign-in, step 1. The response is identical whether or not the username exists
   * (the backend never leaks account existence) — never tell the user which.
   */
  otpRequest: (username: string) =>
    api.post<{ message: string; expires_in: number }>("/accounts/auth/otp/request/", { body: { username }, auth: false }),

  /** Browser sign-in, step 2. 401 `otp_invalid` messages include the remaining attempts. */
  otpVerify: (username: string, code: string): Promise<{ token: string; user: User }> =>
    api
      .post<AuthTokenResponse>("/accounts/auth/otp/verify/", { body: { username, code }, auth: false })
      .then((res) => ({ token: res.token, user: toUser(res.user) })),

  /** Deletes the server-side token. A 401 just means it was already gone, so callers treat it as success. */
  logout: (): Promise<null> => api.post<null>("/accounts/auth/logout/", { body: {} }),

  me: (): Promise<User> => api.get<RawUser>("/accounts/me/").then(toUser),

  updateMe: (patch: {
    full_name?: string;
    phone?: string;
    preferred_currency_id?: string;
    locale?: string;
    notify_telegram?: boolean;
    notify_email?: boolean;
  }): Promise<User> => api.patch<RawUser>("/accounts/me/", { body: patch }).then(toUser),
};
