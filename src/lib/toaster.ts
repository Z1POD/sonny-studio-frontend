// src/lib/toaster.ts


import { toast as sonnerToast, type ExternalToast } from "sonner";
import { haptics } from "@/shared/lib/haptics";

type ToastId = string | number;
type Message = Parameters<typeof sonnerToast>[0];

function withHaptic<Args extends unknown[], R>(
  fn: (...args: Args) => R,
  fire: () => void
) {
  return (...args: Args): R => {
    fire();
    return fn(...args);
  };
}

const baseToast = withHaptic(sonnerToast, () => haptics.impactOccurred("light"));

export const appToast = Object.assign(baseToast, {
  success: withHaptic(sonnerToast.success, () => haptics.notificationOccurred("success")),
  error: withHaptic(sonnerToast.error, () => haptics.notificationOccurred("error")),
  warning: withHaptic(sonnerToast.warning, () => haptics.notificationOccurred("warning")),
  info: withHaptic(sonnerToast.info, () => haptics.impactOccurred("light")),
  message: withHaptic(sonnerToast.message, () => haptics.impactOccurred("light")),

  loading: sonnerToast.loading,

  // Dismissing shouldn't buzz the phone.
  dismiss: sonnerToast.dismiss,
  custom: sonnerToast.custom,

  promise<T>(
    promise: Promise<T> | (() => Promise<T>),
    data: Parameters<typeof sonnerToast.promise>[1]
  ): ToastId {
    const run = typeof promise === "function" ? promise() : promise;
    run.then(
      () => haptics.notificationOccurred("success"),
      () => haptics.notificationOccurred("error")
    );
    return sonnerToast.promise(run, data) as unknown as ToastId;
  },
});

export type { ExternalToast };