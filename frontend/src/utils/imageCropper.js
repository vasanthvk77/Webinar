/**
 * imageCropper.js
 * Client-side image validation and auto-cropping utility for ProxBytes Certificate Slots.
 *
 * Rules:
 * 1. Checks file type and dimensions.
 * 2. If aspect ratio differs from slot's target aspect ratio, it crops equally
 *    from all outer dimensions (top/bottom or left/right) around the center.
 * 3. Preserves PNG alpha transparency and outputs high-density image blob.
 */

/**
 * Validate an image file (type and size)
 * @param {File} file
 * @param {number} maxSizeBytes
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateImageFile(file, maxSizeBytes = 8 * 1024 * 1024) {
  if (!file) return { valid: false, error: 'No file selected.' };

  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!validTypes.includes(file.type.toLowerCase())) {
    return { valid: false, error: 'Only PNG, JPG, and WEBP image formats are supported.' };
  }

  if (file.size > maxSizeBytes) {
    const sizeMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    return { valid: false, error: `Image file exceeds maximum allowed size of ${sizeMb} MB.` };
  }

  return { valid: true };
}

/**
 * Crops and scales an uploaded logo to fit the exact target aspect ratio and dimensions.
 * Crops equally from all dimensions (centered crop) to fill the slot perfectly without distortion.
 *
 * @param {File | Blob | string} sourceImage - File object or image URL
 * @param {number} targetWidth - Target width in design units
 * @param {number} targetHeight - Target height in design units
 * @param {'crop' | 'fit'} mode - 'crop' (center-fill) or 'fit' (contain with transparent padding)
 * @returns {Promise<{ blob: Blob, dataUrl: string, cropped: boolean }>}
 */
export async function cropAndFitToSlot(sourceImage, targetWidth, targetHeight, mode = 'crop') {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const isString = typeof sourceImage === 'string';
    const objectUrl = isString ? sourceImage : URL.createObjectURL(sourceImage);

    img.onload = () => {
      if (!isString) URL.revokeObjectURL(objectUrl);

      const naturalW = img.naturalWidth || img.width;
      const naturalH = img.naturalHeight || img.height;

      const targetAspect = targetWidth / targetHeight;
      const imageAspect = naturalW / naturalH;

      const aspectDiff = Math.abs(targetAspect - imageAspect);
      const isAspectMatch = aspectDiff < 0.02; // within 2% margin

      // High density output canvas (2x for retina crystal-clear rendering)
      const canvas = document.createElement('canvas');
      const scaleFactor = Math.max(2, Math.min(4, Math.round(1200 / targetWidth)));
      canvas.width = targetWidth * scaleFactor;
      canvas.height = targetHeight * scaleFactor;

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      let wasCropped = false;

      if (isAspectMatch) {
        // Direct draw
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      } else if (mode === 'crop') {
        // Crop equally from all dimensions
        wasCropped = true;
        let sx, sy, sWidth, sHeight;

        if (imageAspect > targetAspect) {
          // Source is wider: crop left & right equally
          sHeight = naturalH;
          sWidth = naturalH * targetAspect;
          sx = (naturalW - sWidth) / 2;
          sy = 0;
        } else {
          // Source is taller: crop top & bottom equally
          sWidth = naturalW;
          sHeight = naturalW / targetAspect;
          sx = 0;
          sy = (naturalH - sHeight) / 2;
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
      } else {
        // Contain / letterbox mode: fit within slot with transparent borders
        let dw, dh, dx, dy;
        if (imageAspect > targetAspect) {
          dw = canvas.width;
          dh = canvas.width / imageAspect;
          dx = 0;
          dy = (canvas.height - dh) / 2;
        } else {
          dh = canvas.height;
          dw = canvas.height * imageAspect;
          dx = (canvas.width - dw) / 2;
          dy = 0;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, dx, dy, dw, dh);
      }

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'));
            return;
          }
          const dataUrl = canvas.toDataURL('image/png');
          resolve({ blob, dataUrl, cropped: wasCropped });
        },
        'image/png',
        0.98
      );
    };

    img.onerror = () => {
      if (!isString) URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for cropping calculation.'));
    };

    img.src = objectUrl;
  });
}
