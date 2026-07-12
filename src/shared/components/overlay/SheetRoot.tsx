// src/shared/components/overlay/SheetRoot.tsx

"use client";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { useOverlayStore } from "@/shared/stores/overlay-store";

/** Mounted once via OverlayRoot. Renders every imperative bottom-sheet in the
 * store's stack via the shared Drawer primitive — drag-to-dismiss, focus
 * trap, and pointer-events locking all come from vaul/Radix instead of
 * hand-rolled motion.div drag handling. */
export function SheetRoot() {
  const sheets = useOverlayStore((s) => s.sheets);
  const closeSheet = useOverlayStore((s) => s.closeSheet);

  return (
    <>
      {sheets.map((s) => (
        <Drawer
          key={s.id}
          open
          dismissible={s.dismissible !== false}
          onOpenChange={(open) => {
            if (!open) closeSheet(s.id);
          }}
        >
          <DrawerContent className="mx-auto max-h-[92dvh] sm:max-w-lg">
            <DrawerTitle
              className={cn(
                "px-6 pt-2 text-base font-semibold tracking-tight text-foreground",
                !s.title && "sr-only",
              )}
            >
              {s.title ?? "Sheet"}
            </DrawerTitle>
            {s.description && (
              <DrawerDescription className="mt-1 px-6 text-sm text-muted-foreground">
                {s.description}
              </DrawerDescription>
            )}
            <div className="max-h-[80dvh] overflow-y-auto px-6 py-5 no-scrollbar">
              {s.content}
            </div>
          </DrawerContent>
        </Drawer>
      ))}
    </>
  );
}