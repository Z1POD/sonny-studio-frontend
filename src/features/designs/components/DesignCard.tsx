// src/features/designs/components/DesignCard.tsx

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Archive, Copy, Trash2, ImageIcon, Eye, Globe, Loader2, Clock } from "lucide-react";
import { appToast as toast } from "@/lib/toaster";
import { useNavigate } from "@tanstack/react-router";
import type { ProductListItem } from "@/features/store/api";
import { storeProductApi, getRetailPrice, publishBlockerMessage } from "@/features/store/api";
import { useConfirm } from "@/shared/components/ConfirmModal";
import { designKeys } from "../queries";
import { StatusBadge } from "./StatusBadge";
import { QuickBtn } from "./QuickBtn";
import { DesignLightbox } from "./DesignLightbox";
import { haptics } from "@/shared/lib/haptics";

interface DesignCardProps {
  design: ProductListItem;
  onOpenDetail: (d: ProductListItem) => void;
  onOpenEdit: (d: ProductListItem) => void;
  onMutated: () => void;
}

export function DesignCard({ design, onOpenDetail, onOpenEdit, onMutated }: DesignCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirm, ConfirmModal] = useConfirm();
  const [lightbox, setLightbox] = useState(false);

  const isPublished = design.is_published || design.status === "published";
  const isPending = design.status === "pending_review";

  const archiveMutation = useMutation({
    mutationFn: () => storeProductApi.archive(design.id),
    onSuccess: () => {
      toast.success("Design archived");
      queryClient.invalidateQueries({ queryKey: designKeys.all });
      onMutated();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to archive"),
  });

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.impactOccurred("heavy");
    const ok = await confirm({
      title: "Archive this design?",
      description: "It disappears from the marketplace right away. Past orders are not affected.",
      confirmLabel: "Archive",
      danger: true,
    });
    if (ok) archiveMutation.mutate();
  };

  // Published designs are frozen: iterate on an editable copy (saved as a new draft, published through review).
  const handleCopyEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate({ to: "/studio", search: { blank: design.blank.slug, from: design.slug } });
  };

  const deleteMutation = useMutation({
    mutationFn: () => storeProductApi.deleteProduct(design.id),
    onSuccess: () => {
      toast.success("Design deleted");
      queryClient.invalidateQueries({ queryKey: designKeys.all });
      onMutated();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const publishMutation = useMutation({
    mutationFn: () => storeProductApi.publish(design.id),
    onSuccess: (res: any) => {
      // Publishing now goes through review: the server answers is_published:false + review_id.
      if (res && res.is_published === false) toast.success("Submitted for review. We'll make it live once approved.");
      else toast.success("Design published!");
      queryClient.invalidateQueries({ queryKey: designKeys.all });
      onMutated();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to publish"),
  });

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.impactOccurred("heavy");
    const ok = await confirm({
      title: "Delete this design?",
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) deleteMutation.mutate();
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenEdit(design);
  };

  const handlePublish = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Not publishable yet (e.g. no markup): send the creator to the review modal instead of a doomed request.
    const blocked = publishBlockerMessage(design);
    if (blocked) {
      toast.info(blocked);
      onOpenEdit(design);
      return;
    }
    const d = design;
    const ok = await confirm({
      title: "Submit for review?",
      description:
        "Our team reviews every design before it goes live in the marketplace. Make sure the mockup, name, description, and color/variant all look right.",
      confirmLabel: "Submit for review",
      preview: {
        imageUrl: design.thumbnail_url ?? undefined,
        title: design.title,
        subtitle: getRetailPrice(design),
        details: [
          ...(d.description ? [{ label: "Description", value: d.description }] : []),
          { label: "Blank", value: d.blank.name },
        ],
      },
    });
    if (ok) publishMutation.mutate();
  };

  const handle3D = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate({ to: "/studio", search: { blank: design.blank.slug, design: design.id, view: "3d" } });
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="group relative overflow-hidden md:rounded-3xl border border-border bg-surface"
      >
        <div
          className="relative aspect-square w-full cursor-zoom-in overflow-hidden bg-muted"
          onClick={(e) => { e.stopPropagation(); setLightbox(true); }}
        >
          {design.thumbnail_url ? (
            <img
              src={design.thumbnail_url}
              alt={design.title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}

          <div className="absolute right-2.5 top-2.5 flex flex-col gap-1.5 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
            {isPublished ? (
              <QuickBtn onClick={handleCopyEdit} title="Copy & edit">
                <Copy className="h-3 w-3" />
              </QuickBtn>
            ) : (
              <QuickBtn onClick={handleEdit} title="Edit">
                <Pencil className="h-3 w-3" />
              </QuickBtn>
            )}
            <QuickBtn onClick={(e) => { e.stopPropagation(); onOpenDetail(design); }} title="Details">
              <Eye className="h-3 w-3" />
            </QuickBtn>
            {isPublished ? (
              <QuickBtn onClick={handleArchive} title="Archive" loading={archiveMutation.isPending} danger>
                <Archive className="h-3 w-3" />
              </QuickBtn>
            ) : (
              <QuickBtn onClick={handleDelete} title="Delete" loading={deleteMutation.isPending} danger>
                <Trash2 className="h-3 w-3" />
              </QuickBtn>
            )}
          </div>

          <div className="absolute left-2.5 top-2.5">
            <StatusBadge design={design} />
          </div>
        </div>

        <div
          className="cursor-pointer px-4 py-3"
          onClick={() => onOpenDetail(design)}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-1 flex-1 text-sm font-medium leading-snug">
              {design.title}
            </p>
            <p className="shrink-0 text-sm font-semibold">{getRetailPrice(design)}</p>
          </div>

          {/* <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {new Date(design.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div> */}

          <div className="mt-3 flex flex-col md:flex-row gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); onOpenDetail(design); }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/50 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Eye className="h-3.5 w-3.5" />
              Details
            </button>

            {!isPublished && (
              <button
                onClick={handlePublish}
                disabled={publishMutation.isPending || isPending}
                title={isPending ? "Already submitted — waiting for review" : undefined}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#054236] to-[#0a6b57] py-2 text-xs font-medium text-white shadow-[0_0_12px_rgba(5,66,54,0.45)] transition hover:shadow-[0_0_18px_rgba(5,66,54,0.65)] disabled:opacity-50"
              >
                {publishMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isPending ? (
                  <Clock className="h-3.5 w-3.5" />
                ) : (
                  <Globe className="h-3.5 w-3.5" />
                )}
                {isPending ? "In review" : "Publish"}
              </button>
            )}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {lightbox && design.thumbnail_url && (
          <DesignLightbox
            images={[{ url: design.thumbnail_url, label: design.title }]}
            initialIndex={0}
            onClose={() => setLightbox(false)}
          />
        )}
      </AnimatePresence>

      {ConfirmModal}
    </>
  );
}