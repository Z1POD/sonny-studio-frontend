import { PenLine, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyDesignsProps {
  filtered: boolean;
  onNewDesign: () => void;
}

export function EmptyDesigns({ filtered, onNewDesign }: EmptyDesignsProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-6">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-muted">
        <PenLine className="h-7 w-7 text-muted-foreground/50" />
      </div>
      <p className="text-base font-semibold">
        {filtered ? "No designs here" : "No designs yet"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {filtered
          ? "Try a different filter."
          : "Designs you create in the studio will appear here."}
      </p>
      {!filtered && (
        <Button className="mt-5 gap-2" onClick={onNewDesign}>
          <Plus className="h-4 w-4" />
          Create your first design
        </Button>
      )}
    </div>
  );
}