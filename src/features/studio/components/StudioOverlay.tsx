import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OverlayStep {
  label: string;
  state: "todo" | "active" | "done";
}

interface Props {
  tone?: "busy" | "error";
  title: string;
  detail?: string;
  steps?: OverlayStep[];
  /** Error actions. */
  onRetry?: () => void;
  retryLabel?: string;
  onSecondary?: () => void;
  secondaryLabel?: string;
}

/**
 * Full-screen, blurred, semi-transparent layer above everything in the studio. It swallows pointer input, so nothing
 * can be tapped while the studio is saving or after the canvas failed.
 */
export function StudioOverlay({ tone = "busy", title, detail, steps, onRetry, retryLabel = "Try again", onSecondary, secondaryLabel }: Props) {
  return (
    <div
      role={tone === "error" ? "alertdialog" : "status"}
      aria-live="polite"
      aria-busy={tone === "busy"}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background/60 p-6 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-xs flex-col items-center gap-3 text-center">
        {tone === "busy" ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <span className="grid h-11 w-11 place-items-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
        )}
        <div>
          <p className={cn("font-semibold text-foreground", tone === "error" ? "text-base" : "text-sm")}>{title}</p>
          {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
        </div>
        {steps && steps.length > 0 && (
          <ul className="mt-1 w-full space-y-1.5 text-left">
            {steps.map((s) => (
              <li key={s.label} className={cn("flex items-center gap-2 text-xs", s.state === "todo" ? "text-muted-foreground/60" : "text-foreground")}>
                <span className="grid h-4 w-4 shrink-0 place-items-center">
                  {s.state === "done" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : s.state === "active" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />}
                </span>
                {s.label}
              </li>
            ))}
          </ul>
        )}
        {tone === "error" && (onRetry || onSecondary) && (
          <div className="mt-2 flex gap-2">
            {onSecondary && (
              <button onClick={onSecondary} className="rounded-full bg-muted px-5 py-2 text-[13px] font-medium text-foreground">
                {secondaryLabel ?? "Reload"}
              </button>
            )}
            {onRetry && (
              <button onClick={onRetry} className="rounded-full bg-primary px-5 py-2 text-[13px] font-semibold text-primary-foreground">
                {retryLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
