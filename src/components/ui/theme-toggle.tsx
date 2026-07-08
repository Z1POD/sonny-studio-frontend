import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/shared/stores/theme-store";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const mode = useTheme((s) => s.mode);
  const toggle = useTheme((s) => s.toggle);

  return (
    <button
      onClick={toggle}
      aria-label={
        mode === "dark"
          ? "Switch to light mode"
          : "Switch to dark mode"
      }
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors bg-muted/60 hover:bg-muted hover:text-foreground",
        className
      )}
    >
      {mode === "dark" ? (
        <Sun className="h-4 w-4 rounded-full bg-amber-100/80 p-0.5 text-amber-500 dark:bg-amber-500/15 dark:text-amber-300" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}