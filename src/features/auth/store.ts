// src/features/auth/store.ts

/**
 * Auth store — single source of truth for the active session.
 * The token is persisted to localStorage via the API client; this store
 * mirrors it for reactive consumers and tracks the current user.
 */
import { create } from "zustand";
import {
  ApiError,
  getStoredToken,
  setStoredToken,
} from "@/shared/api/client";
import type { User } from "@/shared/api/types";
import { authApi } from "./api";
import { features } from "process";

interface AuthState {
  token: string | null;
  user: User | null;
  status: "idle" | "loading" | "authenticated" | "unauthenticated";
  hydrate: () => Promise<void>;
  setToken: (token: string, user?: User) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  status: "idle",

  async hydrate() {
    if (get().status === "loading") return;
    const token = getStoredToken();
    if (!token) {
      set({ status: "unauthenticated", token: null, user: null });
      return;
    }
    set({ status: "loading", token });
    try {
      const user = await authApi.me();
      set({ user, status: "authenticated" });
    } catch (err) {
      // Only invalidate the session on an explicit 401 Unauthorized.
      // Network errors, 5xx server errors, or timeouts should NOT log the
      // user out — the token is still valid; the server is just unreachable.
      if (err instanceof ApiError && err.status === 401) {
        setStoredToken(null);
        set({ token: null, user: null, status: "unauthenticated" });
      } else {
        // Keep the token; mark as authenticated so the UI doesn't redirect.
        // The user object will be null until the next successful hydration.
        set({ status: "authenticated" });
      }
    }
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

  async logout() {
    await authApi.logout();
    setStoredToken(null);
    set({ token: null, user: null, status: "unauthenticated" });
  },
}));