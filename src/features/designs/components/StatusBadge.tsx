import { Globe, Archive, PenLine } from "lucide-react";
import type { ProductListItem } from "@/features/store/api";

interface StatusBadgeProps {
  design: ProductListItem;
}

export function StatusBadge({ design }: StatusBadgeProps) {
  const isPublished = design.is_published || design.status === "published";
  const isArchived = design.status === "archived";

  if (isPublished)
    return (
      <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-600">
        <Globe className="h-2.5 w-2.5" />
        Live
      </span>
    );
  if (isArchived)
    return (
      <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        <Archive className="h-2.5 w-2.5" />
        Archived
      </span>
    );
  return (
    <span className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      <PenLine className="h-2.5 w-2.5" />
      Draft
    </span>
  );
}