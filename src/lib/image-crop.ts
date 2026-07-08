/**
 * src/shared/lib/image-crop.ts
 *
 * Image cropping utilities for social sharing.
 * - Cloudinary URL transformation for server-side 4:5 cropping
 * - Canvas-based center-crop fallback for non-Cloudinary images
 */

/**
 * Checks if a URL is hosted on Cloudinary.
 */
export function isCloudinaryUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("cloudinary.com");
  } catch {
    return false;
  }
}

/**
 * Transforms a Cloudinary URL to enforce 4:5 aspect ratio cropping.
 *
 * Cloudinary URL format: .../image/upload/v1234567890/folder/image.jpg
 * We insert the crop transformation after `/upload/`.
 *
 * Transformations used:
 * - c_fill: crop to fill the dimensions
 * - ar_4:5: aspect ratio 4:5
 * - g_auto: smart gravity (auto-detect focal point)
 * - f_auto: serve optimal format (WebP/AVIF when supported)
 * - q_auto:best: highest quality auto-compression
 *
 * @param url - Original Cloudinary image URL
 * @returns Transformed URL with 4:5 crop
 */
export function getCloudinaryCroppedUrl(url: string): string {
  if (!isCloudinaryUrl(url)) return url;

  const uploadMarker = "/image/upload/";
  const idx = url.indexOf(uploadMarker);
  if (idx === -1) return url;

  const before = url.slice(0, idx + uploadMarker.length);
  const after = url.slice(idx + uploadMarker.length);

  // q_auto:best for highest visual quality while still optimizing delivery
  const transform = "c_fill,ar_4:5,g_auto,f_auto,q_auto:best/";

  return `${before}${transform}${after}`;
}

/**
 * Crops an image to 4:5 aspect ratio using HTML5 Canvas.
 * Performs a center-crop to maintain visual focus.
 *
 * @param imageUrl - Source image URL (must support CORS)
 * @returns Promise resolving to a Blob URL of the cropped JPEG image
 */
export async function canvasCropTo4x5(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;
      const imgAspect = imgWidth / imgHeight;
      const targetAspect = 4 / 5;

      let cropWidth: number;
      let cropHeight: number;
      let cropX: number;
      let cropY: number;

      if (imgAspect > targetAspect) {
        // Image is wider than 4:5 — crop width to match height
        cropHeight = imgHeight;
        cropWidth = cropHeight * targetAspect;
        cropX = (imgWidth - cropWidth) / 2;
        cropY = 0;
      } else {
        // Image is taller than 4:5 — crop height to match width
        cropWidth = imgWidth;
        cropHeight = cropWidth / targetAspect;
        cropX = 0;
        cropY = (imgHeight - cropHeight) / 2;
      }

      canvas.width = cropWidth;
      canvas.height = cropHeight;

      ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas toBlob returned null"));
            return;
          }
          resolve(URL.createObjectURL(blob));
        },
        "image/jpeg",
        0.95, // high quality for story sharing
      );
    };

    img.onerror = () => reject(new Error(`Failed to load image: ${imageUrl}`));
    img.src = imageUrl;
  });
}

/**
 * Gets a 4:5 cropped version of an image URL for Telegram story sharing.
 *
 * Strategy:
 * 1. If Cloudinary: use URL transformation (fast, server-side, high quality)
 * 2. Otherwise: use canvas cropping (client-side fallback)
 *
 * @param imageUrl - Original image URL
 * @returns Promise resolving to the cropped image URL (or original if cropping fails)
 */
export async function getStoryImageUrl(imageUrl: string): Promise<string> {
  if (isCloudinaryUrl(imageUrl)) {
    return getCloudinaryCroppedUrl(imageUrl);
  }
  return canvasCropTo4x5(imageUrl);
}
