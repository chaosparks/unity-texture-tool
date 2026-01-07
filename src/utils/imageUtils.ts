
/**
 * Round dimension to nearest multiple of 4 according to requirements:
 * - 33 -> 32
 * - 34 -> 32
 * - 35 -> 36
 * - If 1 or 2, keep as is.
 */
export const calculateTargetDimension = (val: number): number => {
  if (val <= 2) return val;
  const rem = val % 4;
  // If remainder is 1 or 2, round down. If 3, round up.
  if (rem <= 2) return val - rem;
  return val + (4 - rem);
};

export const resizeImage = async (
  file: File,
  targetWidth: number,
  targetHeight: number
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Draw image to canvas with the new dimensions
      // Use imageSmoothingQuality high for better results
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        file.type,
        0.95 // High quality
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

export const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Failed to load image for dimensions'));
    img.src = URL.createObjectURL(file);
  });
};
