// src/features/store/components/ConfirmModal.tsx

import { useState, useCallback, useRef } from "react";
import { AlertTriangle, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

interface ConfirmInputOptions {
  label?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
}

interface ConfirmPreviewDetail {
  label: string;
  value: string;
}

interface ConfirmPreviewOptions {
  imageUrl?: string;
  title?: string;
  subtitle?: string;
  details?: ConfirmPreviewDetail[];
}

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  input?: ConfirmInputOptions;
  /** Optional product/design preview shown above the description — thumbnail + key details, e.g. for a "review before publishing" confirmation. */
  preview?: ConfirmPreviewOptions;
}

type ConfirmResult = { confirmed: boolean; value: string };

interface ConfirmBodyProps {
  opts: ConfirmOptions;
  resolve: (confirmed: boolean, value?: string) => void;
}

function ConfirmBody({ opts, resolve }: ConfirmBodyProps) {
  const [value, setValue] = useState(opts.input?.defaultValue ?? "");
  const isInvalid = !!opts.input?.required && value.trim().length === 0;

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

      {opts.preview && (
        <div className="mt-4 flex gap-3 rounded-2xl border border-border bg-muted/40 p-3 text-left">
          {opts.preview.imageUrl ? (
            <img
              src={opts.preview.imageUrl}
              alt={opts.preview.title ?? ""}
              className="h-14 w-14 flex-shrink-0 rounded-xl object-cover"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            {opts.preview.title && (
              <p className="truncate text-sm font-medium leading-snug">{opts.preview.title}</p>
            )}
            {opts.preview.subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">{opts.preview.subtitle}</p>
            )}
            {opts.preview.details && opts.preview.details.length > 0 && (
              <dl className="mt-1.5 space-y-0.5">
                {opts.preview.details.map((d) => (
                  <div key={d.label} className="flex gap-1 text-[11px] leading-snug">
                    <dt className="shrink-0 text-muted-foreground">{d.label}:</dt>
                    <dd className="truncate font-medium text-foreground">{d.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      )}

      {opts.input && (
        <div className="mt-4 text-left">
          {opts.input.label && (
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {opts.input.label}
              {opts.input.required && <span className="text-red-500"> *</span>}
            </label>
          )}
          <Textarea
            autoFocus
            rows={3}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={opts.input.placeholder}
            className="resize-none"
          />
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2">
        <Button
          onClick={() => resolve(true, value)}
          variant={opts.danger ? "destructive" : "default"}
          className="w-full"
          disabled={isInvalid}
        >
          {opts.confirmLabel ?? (opts.danger ? "Delete" : "Confirm")}
        </Button>

        <Button
          onClick={() => resolve(false, value)}
          variant="ghost"
          className="w-full text-muted-foreground"
        >
          {opts.cancelLabel ?? "Cancel"}
        </Button>
      </div>
    </div>
  );
}

// Overloads: plain confirm() -> boolean (unchanged behavior for existing callers).
// confirm() with `input` -> { confirmed, value } so the reason text comes back too.
interface ConfirmFn {
  (options: ConfirmOptions & { input?: undefined }): Promise<boolean>;
  (options: ConfirmOptions & { input: ConfirmInputOptions }): Promise<ConfirmResult>;
}

export function useConfirm(): [ConfirmFn, React.ReactElement] {
  const isMobile = useIsMobile();

  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((confirmed: boolean, value?: string) => void) | null>(null);

  const confirmImpl = useCallback((options: ConfirmOptions): Promise<boolean | ConfirmResult> => {
    setOpts(options);

    return new Promise((resolvePromise) => {
      resolverRef.current = (confirmed: boolean, value?: string) => {
        if (options.input) {
          resolvePromise({ confirmed, value: (value ?? "").trim() });
        } else {
          resolvePromise(confirmed);
        }
      };
    });
  }, []);

  const resolve = (confirmed: boolean, value?: string) => {
    resolverRef.current?.(confirmed, value);
    resolverRef.current = null;
    setOpts(null);
  };

  const confirm = confirmImpl as unknown as ConfirmFn;

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