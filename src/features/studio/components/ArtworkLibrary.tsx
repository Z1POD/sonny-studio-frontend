// src/features/studio/components/ArtworkLibrary.tsx


"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Images, Upload, X, Loader2, Plus, Trash2, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Tooltip from "@/components/ui/tooltip2";
import { appToast as toast } from "@/lib/toaster";
import { artworkApi, type ArtworkItem } from "../api";
import { artworkLibraryInfiniteQuery, artworkKeys } from "../queries";

/* Types */

interface ArtworkLibraryProps {
  onSelect: (artwork: { url: string; aspect: number }) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

/* ArtworkCard */

function ArtworkCard({
  artwork,
  onSelect,
  onDelete,
  isMobile,
}: {
  artwork: ArtworkItem;
  onSelect: (a: ArtworkItem) => void;
  onDelete: (id: string) => void;
  isMobile: boolean;
}) {
  const [hover, setHover] = useState(false);
  const aspect = artwork.width / artwork.height || 1;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="group relative cursor-pointer overflow-hidden border border-border/40 bg-surface"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onSelect(artwork)}
    >
      <div className="relative w-full bg-surface-overlay" style={{ aspectRatio: aspect }}>
        <img
          src={artwork.thumbnail_url || artwork.url}
          alt={artwork.name}
          className="h-full w-full object-contain"
          loading="lazy"
        />
        {hover && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-medium text-black">
              Use
            </span>
          </div>
        )}
      </div>

      <div className={`flex items-center justify-between px-1.5 py-1 ${
        isMobile ? "" : "opacity-0 group-hover:opacity-100 transition-opacity"
      }`}>
        <p className="max-w-[80%] truncate text-[10px] text-muted-foreground">{artwork.name}</p>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(artwork.id); }}
          className="rounded p-0.5 text-muted-foreground transition hover:bg-red-500/10 hover:text-red-500"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </motion.div>
  );
}

/* PanelBody */

function PanelBody({
  onUploadClick,
  onClose,
  onSelect,
  onDelete,
  isDragging,
  dropRef,
  onDragOver,
  onDragLeave,
  onDrop,
  fileInputRef,
  onFileChange,
  isMobile,
  showHandle = false,
}: {
  onUploadClick: () => void;
  onClose: () => void;
  onSelect: (a: ArtworkItem) => void;
  onDelete: (id: string) => void;
  isDragging: boolean;
  dropRef: React.RefObject<HTMLDivElement | null>;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isMobile: boolean;
  showHandle?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"library" | "ai">("library");

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(artworkLibraryInfiniteQuery());

  const artworks = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div
      ref={dropRef as React.RefObject<HTMLDivElement>}
      className="relative flex h-full flex-col rounded-2xl border border-border/60 shadow-elevated backdrop-blur-xl glass-light overflow-hidden"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm"
          >
            <Upload className="mb-2 h-8 w-8 text-primary" />
            <p className="text-sm font-medium text-primary">Drop artwork here</p>
            <p className="text-xs text-muted-foreground">PNG, JPG, SVG</p>
          </motion.div>
        )}
      </AnimatePresence>

      {showHandle && (
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Library</p>
          <h3 className="text-sm font-semibold">Your Artworks</h3>
        </div>
        <div className="flex items-center gap-1">
          {activeTab === "library" && (
            <Button type="button" variant="ghost" size="icon" className="relative z-10 h-7 w-7" onClick={onUploadClick} title="Upload">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon" className="relative z-10 h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border/40 px-3 pt-2.5 pb-2">
        <button
          onClick={() => setActiveTab("library")}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors
            ${activeTab === "library" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Images className="h-3.5 w-3.5" />
          Library
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors
            ${activeTab === "ai" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 py-3 pb-[12rem] max-h-[calc(100dvh-16rem)] no-scrollbar">
        {activeTab === "ai" ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2.5 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-overlay">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">Generate artwork from a text prompt</p>
            <Tooltip text="Coming soon">
              <Button variant="outline" size="sm" className="h-8 rounded-full px-4 text-xs" disabled>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Generate with AI
              </Button>
            </Tooltip>
          </div>
        ) : isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !artworks.length ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-overlay">
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">No artworks yet</p>
            <p className="text-[10px] text-muted-foreground">Drag & drop or click + to upload</p>
            <Button
              variant="default"
              size="sm"
              className="mt-1 h-8 rounded-full px-4 text-xs"
              onClick={onUploadClick}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Upload artwork
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 overflow-hidden rounded-t-2xl">
              <AnimatePresence mode="popLayout">
                {artworks.map((a) => (
                  <ArtworkCard
                    key={a.id}
                    artwork={a}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    isMobile={isMobile}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Load more */}
            {hasNextPage && (
              <div className="mt-3 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full px-3 text-[11px]"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? (
                    <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Loading…</>
                  ) : (
                    <><ChevronDown className="mr-1.5 h-3 w-3" /> Load more</>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {activeTab === "library" && (
        <div className="border-t border-border/40 px-4 py-2 text-center text-[10px] text-muted-foreground">
          Drag & drop images here or onto the canvas
        </div>
      )}

      <input
        ref={fileInputRef as React.RefObject<HTMLInputElement>}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onFileChange}
      />
    </div>
  );
}

/* ArtworkLibrary */

export function ArtworkLibrary({ onSelect, isOpen: controlledIsOpen, onClose }: ArtworkLibraryProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  // Use controlled state if provided, otherwise internal
  const isOpen = controlledIsOpen ?? internalIsOpen;
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setInternalIsOpen(false);
    }
  };

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (!images.length) { toast.error("Image files only (PNG, JPG, SVG)"); return; }
      for (const file of images) {
        const id = toast.loading(`Uploading ${file.name}…`);
        try {
          await artworkApi.upload(file);
          toast.success(`${file.name} uploaded`, { id });
        } catch {
          toast.error(`Failed to upload ${file.name}`, { id });
        }
      }
      qc.invalidateQueries({ queryKey: artworkKeys.library() });
    },
    [qc],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!dropRef.current?.contains(e.relatedTarget as Node)) setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation(); setIsDragging(false);
      await uploadFiles(Array.from(e.dataTransfer.files));
    },
    [uploadFiles],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      await uploadFiles(Array.from(e.target.files ?? []));
      e.target.value = "";
    },
    [uploadFiles],
  );

  const handleSelect = useCallback(
    (artwork: ArtworkItem) => {
      onSelect({ url: artwork.url, aspect: artwork.width / artwork.height || 1 });
      if (isMobile) handleClose();
    },
    [onSelect, isMobile, handleClose],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await artworkApi.delete(id);
        toast.success("Artwork deleted");
        qc.invalidateQueries({ queryKey: artworkKeys.library() });
      } catch {
        toast.error("Failed to delete artwork");
      }
    },
    [qc],
  );

  const bodyProps = {
    onUploadClick: () => fileInputRef.current?.click(),
    onClose: handleClose,
    onSelect: handleSelect,
    onDelete: handleDelete,
    isDragging,
    dropRef,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
    fileInputRef,
    onFileChange: handleFileChange,
    isMobile,
  };

  // If not controlled, show the toggle button
  const showToggleButton = controlledIsOpen === undefined;

  const toggleBtn = showToggleButton ? (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={() => setInternalIsOpen((v) => !v)}
      className={
        isMobile
          ? "pointer-events-auto absolute bottom-20 left-4 z-30 flex h-10 w-10 items-center gap-2 rounded-full border border-border/60 bg-surface/90 px-3 text-foreground shadow-elevated backdrop-blur-xl hover:scale-105 transition"
          : "pointer-events-auto absolute left-4 bottom-20 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-surface/90 px-3 text-foreground shadow-elevated backdrop-blur-xl hover:scale-105 transition"
      }
      title="Artwork Library"
    >
      <ImageIcon className="h-8 w-8" />
    </motion.button>
  ) : null;

  /*    Desktop: slide-in side panel    */
  if (!isMobile) {
    return (
      <>
        {toggleBtn}
        <AnimatePresence>
          {isOpen && (
            <motion.aside
              initial={{ opacity: 0, x: -20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 280 }}
              exit={{ opacity: 0, x: -20, width: 0 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className="pointer-events-auto absolute left-4 top-4 z-40 w-[320px] max-w-[90dvw] overflow-hidden rounded-2xl shadow-elevated md:top-[calc(var(--tg-safe-area-top,0px)+var(--tg-header-height,3.5rem))]"
            >
              <PanelBody {...bodyProps} />
            </motion.aside>
          )}
        </AnimatePresence>
      </>
    );
  }

  /*    Mobile: bottom-sheet    */
  return (
    <>
      {toggleBtn}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto absolute inset-0 z-30 bg-black/40"
            onClick={handleClose}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={(_, info) => { if (info.offset.y > 80) handleClose(); }}
            className="pointer-events-auto absolute bottom-0 left-0 right-0 z-40 max-h-[70%] overflow-hidden rounded-t-2xl"
          >
            <PanelBody {...bodyProps} showHandle />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}