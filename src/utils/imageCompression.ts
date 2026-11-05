/**
 * High-performance image compression and optimization utility for cloud persistence.
 * Ensures all track artwork and cover thumbnails fit comfortably within Firestore's 1MB document limit.
 */

export async function compressArtworkForStorage(
  imageUrl: string,
  maxDimension: number = 400,
  quality: number = 0.82
): Promise<string> {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return '';
  }

  // HTTP/HTTPS URLs (e.g. Unsplash or CDN links) are small strings (~100 bytes) and need no compression
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // If not a data URI, return as-is
  if (!imageUrl.startsWith('data:image/')) {
    return imageUrl;
  }

  // If the data URI is already very small (< 40KB), return directly
  if (imageUrl.length < 40_000) {
    return imageUrl;
  }

  return new Promise((resolve) => {
    // Timeout safeguard: if image loading takes too long, resolve with fallback
    const timer = setTimeout(() => {
      console.warn('[ImageOptimizer] Image compression timed out, returning fallback');
      resolve(imageUrl.length > 200_000 ? '' : imageUrl);
    }, 4000);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      clearTimeout(timer);
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height) {
          return resolve(imageUrl);
        }

        // Scale down to maxDimension preserving aspect ratio
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return resolve(imageUrl);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to web-friendly JPEG for high visual fidelity with small byte footprint (~30KB)
        let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        // If still unexpectedly large (> 200KB), perform secondary downscaling
        if (compressedDataUrl.length > 200_000) {
          const secondaryCanvas = document.createElement('canvas');
          const targetW = Math.round(width * 0.7);
          const targetH = Math.round(height * 0.7);
          secondaryCanvas.width = targetW;
          secondaryCanvas.height = targetH;
          const sCtx = secondaryCanvas.getContext('2d');
          if (sCtx) {
            sCtx.imageSmoothingEnabled = true;
            sCtx.drawImage(canvas, 0, 0, targetW, targetH);
            compressedDataUrl = secondaryCanvas.toDataURL('image/jpeg', 0.75);
          }
        }

        resolve(compressedDataUrl);
      } catch (err) {
        console.warn('[ImageOptimizer] Canvas compression failed:', err);
        resolve(imageUrl);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      console.warn('[ImageOptimizer] Failed to load image element for compression');
      resolve(imageUrl);
    };

    img.src = imageUrl;
  });
}
