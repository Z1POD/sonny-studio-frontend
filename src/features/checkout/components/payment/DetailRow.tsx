// src/features/checkout/components/payment/DetailRow.tsx

import { Copy, CheckCircle2 } from "lucide-react";

interface DetailRowProps {
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
}

export function DetailRow({ label, value, onCopy, copied }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold tabular-nums">
          {value}
        </p>
      </div>
      {onCopy && (
        <div
          role="button"
          tabIndex={0}
          onClick={onCopy}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onCopy();
            }
          }}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-all cursor-pointer ${
            copied
              ? "border-green-500/30 bg-green-500/10 text-green-600"
              : "border-border bg-background text-muted-foreground hover:text-foreground"
          }`}
          aria-label={`Copy ${label}`}
        >
          {copied ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </div>
      )}
    </div>
  );
}