// src/features/wallet/components/WalletSheet.tsx
//
// Shared wrapper for all wallet modals: bottom sheet on mobile, centered
// dialog on desktop (md+). Built on the shared Sheet component so it gets
// scroll-lock, focus-trap, and overlay/escape-to-close for free.

"use client";

import { X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export function WalletSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-auto max-h-[90dvh] w-full gap-0 overflow-hidden rounded-t-3xl border border-border/60 bg-surface p-0 shadow-2xl [&>button]:hidden md:inset-x-auto md:left-1/2 md:bottom-auto md:top-1/2 md:h-auto md:max-h-[80dvh] md:w-[650px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl"
      >
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        <SheetHeader className="flex-row items-start justify-between space-y-0 border-b border-border/40 px-5 py-4 text-left">
          <div>
            <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
            {description && (
              <SheetDescription className="mt-0.5 text-xs">{description}</SheetDescription>
            )}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/50 text-muted-foreground transition hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </SheetHeader>

        <div className="max-h-[calc(90dvh-80px)] overflow-y-auto px-5 py-5 md:max-h-[calc(80dvh-80px)] no-scrollbar">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}