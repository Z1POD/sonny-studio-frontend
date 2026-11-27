import { useQueryClient } from "@tanstack/react-query";
import { appToast as toast } from "@/lib/toaster";
import { uploadArtworkFile } from "../api";
import { useStudio } from "../store";
import type { Layer } from "../types";

/** Adds image files to the active zone straight away, then registers them in the background (used by the panel and drag & drop). */
export function useArtworkUpload() {
  const qc = useQueryClient();
  const product = useStudio((s) => s.product);

  async function uploadOne(file: File) {
    if (!product) return;
    if (!product.editor.artworkAllowed.uploads) {
      toast.error("Uploaded artwork is not allowed on this product.");
      return;
    }
    const { acceptedMimeTypes: accepted, maxBytes } = product.editor.upload;
    if (!accepted.includes(file.type)) {
      toast.error("Use a PNG, JPG, SVG or WebP image");
      return;
    }
    if (file.size > maxBytes) {
      toast.error(`That file is over ${Math.round(maxBytes / 1024 / 1024)} MB`);
      return;
    }
    const st = useStudio.getState();
    const preview = URL.createObjectURL(file);
    const id = st.addImage({ name: file.name.replace(/\.[^.]+$/, ""), src: preview, category: "upload", uploading: true });
    try {
      const { assetId } = await uploadArtworkFile(file);
      useStudio.getState().updateLayer(id, { assetId, uploading: false } as Partial<Layer>);
      void qc.invalidateQueries({ queryKey: ["studio", "artwork", "mine"] });
    } catch (e) {
      useStudio.getState().removeLayer(id);
      toast.error(e instanceof Error ? e.message : "Couldn't upload that file");
    }
  }

  /** Several files are handled one after another so each lands as its own layer. */
  async function upload(files: File | File[]) {
    for (const f of Array.isArray(files) ? files : [files]) await uploadOne(f);
  }

  return { upload };
}
