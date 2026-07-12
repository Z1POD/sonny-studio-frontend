// src/features/store/components/ConfirmModal.tsx

import { useState, useCallback, useRef } from "react";
import { AlertTriangle, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type Resolver = (confirmed: boolean) => void;

interface ConfirmBodyProps {
  opts: ConfirmOptions;
  resolve: (value: boolean) => void;
}

function ConfirmBody({ opts, resolve }: ConfirmBodyProps) {
  return (
    <div className="px-6 pb-8 pt-2">
      <div
        className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${
          opts.danger ? "bg-red-500/10" : "bg-primary/10"
        }`}
      >
        {opts.danger ? (
          <AlertTriangle className="h-6 w-6 text-red-500" />
        ) : (
          <Info className="h-6 w-6 text-primary" />
        )}
      </div>

      <DialogTitle className="text-center text-base font-semibold leading-none tracking-normal">
        {opts.title}
      </DialogTitle>

      {opts.description && (
        <DialogDescription className="mt-2 text-center text-sm text-muted-foreground">
          {opts.description}
        </DialogDescription>
      )}

      <div className="mt-6 flex flex-col gap-2">
        <Button
          onClick={() => resolve(true)}
          variant={opts.danger ? "destructive" : "default"}
          className="w-full"
        >
          {opts.confirmLabel ?? (opts.danger ? "Delete" : "Confirm")}
        </Button>

        <Button
          onClick={() => resolve(false)}
          variant="ghost"
          className="w-full text-muted-foreground"
        >
          {opts.cancelLabel ?? "Cancel"}
        </Button>
      </div>
    </div>
  );
}

export function useConfirm(): [
  (opts: ConfirmOptions) => Promise<boolean>,
  React.ReactElement,
] {
  const isMobile = useIsMobile();

  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<Resolver | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setOpts(options);

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const resolve = (value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOpts(null);
  };

  if (isMobile) {
    return [
      confirm,
      <Drawer
        key="confirm-drawer"
        open={!!opts}
        onOpenChange={(open) => !open && resolve(false)}
      >
        <DrawerContent
        className="fixed inset-x-0 bottom-0 z-[61] overflow-hidden 
        rounded-t-3xl border border-border/60 bg-surface p-0 shadow-2xl 
        md:inset-x-auto md:left-1/2 md:top-1/2 md:bottom-auto md:w-[400px] 
        md:max-w-[calc(100vw-2rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl"
        >
          {opts && <ConfirmBody opts={opts} resolve={resolve} />}
        </DrawerContent>
      </Drawer>,
    ];
  }

  return [
    confirm,
    <Dialog
      key="confirm-dialog"
      open={!!opts}
      onOpenChange={(open) => !open && resolve(false)}
    >
      <DialogContent 
        showCloseButton={false} 
        className="fixed inset-x-0 bottom-0 z-[61] overflow-hidden 
        rounded-t-3xl border border-border/60 bg-surface p-0 shadow-2xl 
        md:inset-x-auto md:left-1/2 md:top-1/2 md:bottom-auto md:w-[400px] 
        md:max-w-[calc(100vw-2rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl"
        >
        {opts && <ConfirmBody opts={opts} resolve={resolve} />}
      </DialogContent>
    </Dialog>,
  ];
}