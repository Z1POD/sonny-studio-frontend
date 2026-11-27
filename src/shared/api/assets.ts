/**
 * Asset upload — one step (contract B.4.5):
 *   POST /assets/upload/   multipart: file, purpose, resource_type   →   { id, url, width, height }
 * The returned `id` is what other endpoints reference (`asset_id`, `receipt_asset_id`, `proof_asset_id`).
 * The request is sent with XHR so the caller can show upload progress.
 */
import { API_BASE_URL, ApiError, getStoredToken, parseApiError, api } from "./client";

export type AssetPurpose = "creator_artwork" | "design_mockup" | "payment_receipt" | "job_proof" | "product_thumbnail" | "store_banner";

/** What `POST /assets/upload/` returns. */
export interface UploadedAsset {
  id: string;
  url: string;
  width?: number | null;
  height?: number | null;
}

export interface RegisteredAsset {
  id: string;
  secure_url: string;
  width?: number;
  height?: number;
}

/**
 * Deletes one of the caller's own assets. The server answers `409 asset_in_use` (readable message) while a
 * saved design still references it — callers show that message instead of breaking designs.
 */
export async function deleteAsset(assetId: string): Promise<void> {
  await api.delete(`/assets/${encodeURIComponent(assetId)}/`);
}

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

/** A Blob has no name; the server validates by file name + type, so always send one. */
function fileName(file: Blob, purpose: AssetPurpose): string {
  const named = (file as File).name;
  if (named) return named;
  return `${purpose}.${EXT_BY_MIME[file.type] ?? "png"}`;
}

export function uploadAsset(
  file: Blob,
  purpose: AssetPurpose,
  onProgress: (pct: number) => void = () => {},
): Promise<RegisteredAsset> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file, fileName(file, purpose));
    fd.append("purpose", purpose);
    fd.append("resource_type", purpose === "payment_receipt" || purpose === "job_proof" ? "auto" : "image");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/assets/upload/`);
    const token = getStoredToken();
    if (token) xhr.setRequestHeader("Authorization", `Token ${token}`);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        /* non-JSON body */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        const a = data as UploadedAsset | null;
        if (!a?.id) return reject(new ApiError("Upload returned an unexpected response.", xhr.status, data));
        return resolve({ id: a.id, secure_url: a.url, width: a.width ?? undefined, height: a.height ?? undefined });
      }
      const { message, code, fields } = parseApiError(data, xhr.status);
      reject(new ApiError(message, xhr.status, data, code, fields));
    };
    xhr.onerror = () => reject(new ApiError("Network error during upload.", 0, null));
    xhr.send(fd);
  });
}
