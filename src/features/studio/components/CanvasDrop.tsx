/**
 * CanvasDrop
 *
 * Wraps the 3-D canvas in StudioWorkspace. Any image file dropped anywhere on
 * the viewport is uploaded to the backend via artworkApi.upload and forwarded
 * to the parent via `onUploaded` — which should apply the artwork to the
 * currently selected print area.
 *
 * Kept as its own file so StudioWorkspace stays slim.
 */

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { artworkApi } from "../api";
import { artworkKeys } from "../queries";

interface CanvasDropProps {
  children: React.ReactNode;
  /** Called after a successful upload — apply the artwork to the canvas. */
  onUploaded: (artwork: { url: string; aspect: number }) => void;
}

export function CanvasDrop({ children, onUploaded }: CanvasDropProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCount = useRef(0);
  const qc = useQueryClient();

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCount.current++;
    if (dragCount.current === 1) setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); // required to allow drop
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCount.current = Math.max(0, dragCount.current - 1);
    if (dragCount.current === 0) setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      dragCount.current = 0;
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (!files.length) {
        toast.error("Drop image files only (PNG, JPG, SVG)");
        return;
      }

      // Upload all files; apply only the first one to the canvas immediately.
      for (const [i, file] of files.entries()) {
        const id = toast.loading(`Uploading ${file.name}…`);
        try {
          const artwork = await artworkApi.upload(file);
          toast.success(`${file.name} uploaded`, { id });
          if (i === 0) {
            onUploaded({ url: artwork.url, aspect: artwork.width / artwork.height || 1 });
          }
        } catch {
          toast.error(`Failed to upload ${file.name}`, { id });
        }
      }

      // Refresh library panel so the new item appears without a manual refetch.
      qc.invalidateQueries({ queryKey: artworkKeys.library() });
    },
    [onUploaded, qc],
  );

  return (
    <div
      className="relative h-full w-full"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}

      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(99,102,241,0.18) 0%, rgba(0,0,0,0.5) 100%)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/40 bg-surface/80 px-10 py-8 shadow-elevated backdrop-blur-xl">
              <Upload className="h-9 w-9 text-primary" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-foreground">Drop artwork on the canvas</p>
              <p className="text-xs text-muted-foreground">PNG · JPG · SVG · WebP</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}