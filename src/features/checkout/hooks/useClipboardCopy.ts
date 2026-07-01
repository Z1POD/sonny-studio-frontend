// src/features/checkout/hooks/useClipboardCopy.ts

import { useState, useCallback } from "react";
import { toast } from "sonner";

export function useClipboardCopy(timeoutMs = 2_000) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copy = useCallback(
    async (text: string, field: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), timeoutMs);
        toast.success("Copied");
      } catch {
        toast.error("Could not copy");
      }
    },
    [timeoutMs]
  );

  return { copiedField, copy };
}