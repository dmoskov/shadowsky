/**
 * Compress and resize images to meet Bluesky's requirements
 * with smart cropping to standard aspect ratios
 */

const MAX_DIMENSION = 1000; // Bluesky stores with longest side at 1000px
const MAX_FILE_SIZE = 1000000; // 1MB (Bluesky's limit)
const COMPRESSION_STEP = 0.05; // Reduce quality by 5% each iteration

// Common aspect ratios that display well on Bluesky
const ASPECT_RATIOS = {
  SQUARE: { width: 1, height: 1, name: "1:1" },
  LANDSCAPE: { width: 16, height: 9, name: "16:9" },
  PORTRAIT: { width: 4, height: 5, name: "4:5" },
  WIDE: { width: 1.91, height: 1, name: "1.91:1" },
} as const;

function getClosestAspectRatio(ratio: number) {
  const ratios = [
    ASPECT_RATIOS.SQUARE,
    ASPECT_RATIOS.LANDSCAPE,
    ASPECT_RATIOS.PORTRAIT,
    ASPECT_RATIOS.WIDE,
  ];

  let closest = ratios[0];
  let minDiff = Math.abs(ratio - closest.width / closest.height);

  for (const r of ratios) {
    const diff = Math.abs(ratio - r.width / r.height);
    if (diff < minDiff) {
      minDiff = diff;
      closest = r;
    }
  }

  return closest;
}

export async function compressImage(file: File): Promise<File> {
  // If file is already under the limit, we still might want to crop it
  // Only skip processing if it's already small AND has a standard aspect ratio
  if (file.size <= MAX_FILE_SIZE) {
    // Still check if we need to crop for aspect ratio
    const img = new Image();
    const needsCrop = await new Promise<boolean>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.onload = () => {
          const ratio = img.width / img.height;
          const closest = getClosestAspectRatio(ratio);
          const targetRatio = closest.width / closest.height;
          // If ratio is very close to a standard one, no need to process
          resolve(Math.abs(ratio - targetRatio) > 0.01);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

    if (!needsCrop) {
      return file;
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = async () => {
        try {
          const originalRatio = img.width / img.height;
          const targetAspectRatio = getClosestAspectRatio(originalRatio);
          const targetRatio =
            targetAspectRatio.width / targetAspectRatio.height;

          // Calculate crop dimensions to match target aspect ratio
          let cropX = 0;
          let cropY = 0;
          let cropWidth = img.width;
          let cropHeight = img.height;

          if (originalRatio > targetRatio) {
            // Image is wider than target - crop width
            cropWidth = img.height * targetRatio;
            cropX = (img.width - cropWidth) / 2;
          } else if (originalRatio < targetRatio) {
            // Image is taller than target - crop height
            cropHeight = img.width / targetRatio;
            cropY = (img.height - cropHeight) / 2;
          }

          // Calculate final dimensions, scaling down if needed
          let width = cropWidth;
          let height = cropHeight;

          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            const scale = Math.min(
              MAX_DIMENSION / width,
              MAX_DIMENSION / height,
            );
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }

          // Create canvas for compression
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
          }

          canvas.width = width;
          canvas.height = height;

          // Enable image smoothing for better quality
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          // Draw the cropped portion of the image
          ctx.drawImage(
            img,
            cropX, // source x
            cropY, // source y
            cropWidth, // source width
            cropHeight, // source height
            0, // destination x
            0, // destination y
            width, // destination width
            height, // destination height
          );

          // Try different quality levels until we're under the size limit
          let quality = 0.9;
          let blob: Blob | null = null;
          const outputFormat =
            file.type === "image/png" ? "image/png" : "image/jpeg";

          while (quality > 0.1) {
            blob = await new Promise<Blob | null>((resolve) => {
              canvas.toBlob((b) => resolve(b), outputFormat, quality);
            });

            if (!blob) {
              break;
            }

            if (blob.size <= MAX_FILE_SIZE) {
              break;
            }

            quality -= COMPRESSION_STEP;
          }

          if (!blob || blob.size > MAX_FILE_SIZE) {
            // If we still can't get under the limit, try more aggressive compression
            // Convert PNG to JPEG for better compression
            blob = await new Promise<Blob | null>((resolve) => {
              canvas.toBlob((b) => resolve(b), "image/jpeg", 0.7);
            });
          }

          if (!blob) {
            reject(new Error("Failed to compress image"));
            return;
          }

          // Create a new File from the blob
          const compressedFile = new File(
            [blob],
            file.name.replace(/\.(png|PNG)$/, ".jpg"), // Convert PNG filenames to JPG
            { type: blob.type },
          );

          console.log(
            `Compressed image from ${(file.size / 1024 / 1024).toFixed(2)}MB to ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`,
            `(${img.width}x${img.height} → ${width}x${height}, aspect ratio: ${targetAspectRatio.name})`,
          );

          resolve(compressedFile);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function isCompressibleImage(file: File): boolean {
  return (
    file.type === "image/jpeg" ||
    file.type === "image/jpg" ||
    file.type === "image/png" ||
    file.type === "image/webp"
  );
}
