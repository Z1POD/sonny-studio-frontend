// src/shared/stores/theme-store.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";

type Mode = "light" | "dark";

interface ThemeState {
  mode: Mode;
  toggle: () => void;
  set: (m: Mode) => void;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "dark",
      toggle: () => set((s) => ({ mode: s.mode === "dark" ? "light" : "dark" })),
      set: (mode) => set({ mode }),
    }),
    { name: "ml-theme" },
  ),
);

export function applyThemeClass(mode: Mode) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.style.colorScheme = mode;
}