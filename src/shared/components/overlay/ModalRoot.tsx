// src/shared/components/overlay/ModalRoot.tsx

"use client";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import { useOverlayStore } from "@/shared/stores/overlay-store";

const SIZE_CLASS: Record<string, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

/** Mounted once via OverlayRoot. Renders every modal in the store's stack as
 * a bottom sheet (the app-wide standard) via the shared Drawer primitive —
 * each is its own Drawer.Root, so multiple/overlapping modals share the same
 * pointer-events + layering management instead of fighting it. */
export function ModalRoot() {
  const modals = useOverlayStore((s) => s.modals);
  const closeModal = useOverlayStore((s) => s.closeModal);

  return (
    <>
      {modals.map((m) => (
        <Drawer
          key={m.id}
          open
          dismissible={m.dismissible !== false}
          onOpenChange={(open) => {
            if (!open) closeModal(m.id);
          }}
        >
          <DrawerContent className={cn("mx-auto max-h-[85dvh]", SIZE_CLASS[m.size ?? "md"])}>
            <div className="flex items-start justify-between gap-4 px-6 pt-2">
              <div className="min-w-0">
                <DrawerTitle
                  className={cn(
                    "text-base font-semibold tracking-tight text-foreground",
                    !m.title && "sr-only",
                  )}
                >
                  {m.title ?? "Dialog"}
                </DrawerTitle>
                {m.description && (
                  <DrawerDescription className="mt-1 text-sm text-muted-foreground">
                    {m.description}
                  </DrawerDescription>
                )}
              </div>
              {m.dismissible !== false && (
                <DrawerClose
                  className="-mr-2 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </DrawerClose>
              )}
            </div>
            <div className="max-h-[100%] overflow-auto px-6 pb-6 pt-3">{m.content}</div>
          </DrawerContent>
        </Drawer>
      ))}
    </>
  );
}