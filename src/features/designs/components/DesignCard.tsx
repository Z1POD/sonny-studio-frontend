import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Box, Trash2, ImageIcon, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import type { ProductListItem } from "@/features/store/api";
import { storeProductApi, getRetailPrice } from "@/features/store/api";
import { useConfirm } from "@/features/store/components/ConfirmModal";
import { designKeys } from "../queries";
import { StatusBadge } from "./StatusBadge";
import { QuickBtn } from "./QuickBtn";
import { DesignLightbox } from "./DesignLightbox";

interface DesignCardProps {
  design: ProductListItem;
  onOpenDetail: (d: ProductListItem) => void;
  onMutated: () => void;
}

export function DesignCard({ design, onOpenDetail, onMutated }: DesignCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirm, ConfirmModal] = useConfirm();
  const [lightbox, setLightbox] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => storeProductApi.deleteProduct(design.id),
    onSuccess: () => {
      toast.success("Design deleted");
      queryClient.invalidateQueries({ queryKey: designKeys.all });
      onMutated();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
    navigate({
      to: "/studio",
      state: { productId: design.id },
    });
  };

  const handle3D = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate({
      to: "/studio",
      state: { productId: design.id, mode: "3d" },
    });
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
            <QuickBtn onClick={handleEdit} title="Edit in Studio">
              <Pencil className="h-3 w-3" />
            </QuickBtn>
            <QuickBtn onClick={handle3D} title="3D Canvas">
              <Box className="h-3 w-3" />
            </QuickBtn>
            <QuickBtn onClick={(e) => { e.stopPropagation(); onOpenDetail(design); }} title="Order">
              <ShoppingCart className="h-3 w-3" />
            </QuickBtn>
            <QuickBtn
              onClick={handleDelete}
              title="Delete"
              loading={deleteMutation.isPending}
              danger
            >
              <Trash2 className="h-3 w-3" />
            </QuickBtn>
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
            <p className="line-clamp-2 flex-1 text-sm font-medium leading-snug">
              {design.title}
            </p>
            <p className="shrink-0 text-sm font-semibold">{getRetailPrice(design)}</p>
          </div>

          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {new Date(design.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onOpenDetail(design); }}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/50 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            {design.sold_quantity > 0 ? "Order" : "Order Now"}
          </button>
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