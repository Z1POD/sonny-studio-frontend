import { create } from "zustand";
import {
  ApiError,
  getStoredToken,
  setStoredToken,
} from "@/shared/api/client";
import type { User } from "@/shared/api/types";
import { authApi } from "./api";

interface AuthState {
  token: string | null;
  user: User | null;
  status: "idle" | "loading" | "authenticated" | "unauthenticated";
  hydrate: () => Promise<void>;
  setToken: (token: string, user?: User) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Exchanges Telegram initData for a session. Multiple callers (root's
   * background sign-in + splash's auto-login retry) can ask for this at
   * the same moment on a fresh launch — they share one in-flight request
   * instead of hitting /auth/telegram/ twice.
   */
  loginWithTelegram: (initData: string) => Promise<User | null>;
}

// Module-level, not store state — these are plumbing for de-duping
// concurrent calls, not something that should trigger re-renders.
let hydratePromise: Promise<void> | null = null;
let telegramLoginPromise: Promise<User | null> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  status: "idle",

  async hydrate() {
    if (hydratePromise) return hydratePromise;

    const token = getStoredToken();
    if (!token) {
      set({ status: "unauthenticated", token: null, user: null });
      return;
    }
    if (get().status === "authenticated" && get().user) {
      return;
    }

    set({ status: "loading", token });
    hydratePromise = (async () => {
      const hadUser = !!get().user;
      try {
        const user = await authApi.me();
        set({ user, status: "authenticated" });
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setStoredToken(null);
          set({ token: null, user: null, status: "unauthenticated" });
        } else if (hadUser) {
          // Transient failure on a re-check of an already-established session —
          // keep showing what we had rather than punish the user for a blip.
          set({ status: "authenticated" });
        } else {
          // First hydrate, no cached user, and the backend didn't actually
          // confirm anything. Don't pretend we're in — go back to "idle" so
          // callers that retry on idle (AuthenticatedLayout) will actually
          // retry, instead of getting stuck "authenticated" with nothing to show.
          set({ status: "idle" });
        }
      } finally {
        hydratePromise = null;
      }
    })();
    return hydratePromise;
  },

  setToken(token, user) {
    setStoredToken(token);
    set({
      token,
      user: user ?? get().user,
      status: "authenticated",
    });
  },

  async refreshUser() {
    try {
      const user = await authApi.me();
      set({ user, status: "authenticated" });
    } catch {
      /* no-op — hydrate handles failure */
    }
  },

  async loginWithTelegram(initData) {
    // Already signed in (e.g. hydrate() just won the race) — nothing to do.
    if (get().status === "authenticated" && get().user) {
      return get().user;
    }
    if (telegramLoginPromise) return telegramLoginPromise;

    telegramLoginPromise = (async () => {
      try {
        const data = await authApi.loginTelegram(initData);
        get().setToken(data.token, data.user);
        return data.user ?? null;
      } finally {
        telegramLoginPromise = null;
      }
    })();
    return telegramLoginPromise;
  },

  async logout() {
    await authApi.logout();
    setStoredToken(null);
    set({ token: null, user: null, status: "unauthenticated" });
  },
}));