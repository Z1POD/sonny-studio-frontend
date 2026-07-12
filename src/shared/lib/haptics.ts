// src/shared/lib/haptics.ts

import { getTelegramWebApp } from "@/shared/hooks/use-telegram";

export type ImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
export type NotificationType = "error" | "success" | "warning";

// HapticFeedback was introduced in Bot API 6.1.
const MIN_HAPTIC_VERSION = "6.1";

function getHapticController() {
  const tg = getTelegramWebApp();
  if (!tg?.HapticFeedback) return null;
  if (tg.isVersionAtLeast && !tg.isVersionAtLeast(MIN_HAPTIC_VERSION)) return null;
  return tg.HapticFeedback;
}

function isAndroidClient(): boolean {
  const tg = getTelegramWebApp();
  return (tg?.platform ?? "").toLowerCase().includes("android");
}

export function impactOccurred(style: ImpactStyle = "medium"): void {
  const haptic = getHapticController();
  if (!haptic) return;

  if (isAndroidClient()) {
    haptic.notificationOccurred("success");
    return;
  }
  haptic.impactOccurred(style);
}


export function notificationOccurred(type: NotificationType = "success"): void {
  const haptic = getHapticController();
  if (!haptic) return;
  haptic.notificationOccurred(type);
}


export function selectionChanged(): void {
  const haptic = getHapticController();
  if (!haptic) return;

  if (isAndroidClient()) {
    haptic.notificationOccurred("success");
    return;
  }
  haptic.selectionChanged();
}

export const haptics = {
  impactOccurred,
  notificationOccurred,
  selectionChanged,
};