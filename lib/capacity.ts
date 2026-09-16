/**
 * capacity.ts — Calculate and validate the steganographic capacity of a PNG cover image.
 *
 * Each pixel contributes 3 usable bits (R, G, B — Alpha is untouched).
 * We reserve 4 bytes (32 bits) at the start for the payload length header.
 * A 90 % safety margin is applied to the theoretical maximum.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const CHANNELS_USED = 3; // R, G, B (skip Alpha)
const BITS_PER_CHANNEL = 1; // LSB only
const SAFETY_FACTOR = 0.9; // Use only 90 % of theoretical max
const LENGTH_HEADER_BYTES = 4; // 32-bit length prefix

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CapacityResult {
  fits: boolean;
  maxBytes: number;
  payloadBytes: number;
  usagePercent: number;
}

// ─── Capacity Calculation ────────────────────────────────────────────────────

/**
 * Returns the maximum safe payload size in bytes for a given image resolution.
 */
export function calculateMaxCapacity(
  imageWidth: number,
  imageHeight: number
): number {
  const totalPixels = imageWidth * imageHeight;
  const totalBits = totalPixels * CHANNELS_USED * BITS_PER_CHANNEL;
  const theoreticalBytes = Math.floor(totalBits / 8);

  // Apply safety margin and subtract the length header overhead
  const safeBytes = Math.floor(theoreticalBytes * SAFETY_FACTOR) - LENGTH_HEADER_BYTES;

  return Math.max(0, safeBytes);
}

// ─── Formatting Helpers ──────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── Capacity Validation ─────────────────────────────────────────────────────

/**
 * Check whether a payload of `payloadSizeBytes` fits in a cover image
 * of the given dimensions.
 */
export function checkCapacity(
  payloadSizeBytes: number,
  imageWidth: number,
  imageHeight: number
): CapacityResult {
  const maxBytes = calculateMaxCapacity(imageWidth, imageHeight);
  const fits = payloadSizeBytes <= maxBytes;
  const usagePercent = maxBytes > 0 ? (payloadSizeBytes / maxBytes) * 100 : 100;

  return {
    fits,
    maxBytes,
    payloadBytes: payloadSizeBytes,
    usagePercent: Math.round(usagePercent * 100) / 100,
  };
}

// ─── Secret File Size Estimation ──────────────────────────────────────────────

// Estimated encryption & wire serialization overhead:
// 16 (salt) + 12 (iv) + 16 (authTag) + 2 (nameLen) + ~30 (avg filename) + 4 (dataLen) ≈ 80 bytes
const CRYPTO_OVERHEAD_BYTES = 80;

/**
 * Returns the estimated maximum raw file size that can be safely embedded
 * into a PNG with the given dimensions after encryption and serialization.
 */
export function estimateMaxSecretFileSize(
  imageWidth: number,
  imageHeight: number
): number {
  const maxSafePayload = calculateMaxCapacity(imageWidth, imageHeight);
  return Math.max(0, maxSafePayload - CRYPTO_OVERHEAD_BYTES);
}


// ─── PNG Dimension Extractor (Browser & Server) ───────────────────────────────

/**
 * Reads PNG width and height directly from the file header (IHDR chunk).
 * Falls back to HTML Image() decoding in the browser if the IHDR parse fails.
 */
export async function getPngDimensions(
  file: File | Blob
): Promise<{ width: number; height: number } | null> {
  try {
    const headerBuffer = await file.slice(0, 24).arrayBuffer();
    const view = new DataView(headerBuffer);
    // PNG signature: 0x89 0x50 0x4E 0x47, 0x0D 0x0A 0x1A 0x0A
    if (
      view.getUint32(0) === 0x89504e47 &&
      view.getUint32(4) === 0x0d0a1a0a
    ) {
      const width = view.getUint32(16);
      const height = view.getUint32(20);
      if (width > 0 && height > 0) {
        return { width, height };
      }
    }
  } catch {
    // Continue to Image element fallback
  }

  if (typeof window !== "undefined" && typeof Image !== "undefined") {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const dims = { width: img.naturalWidth, height: img.naturalHeight };
        URL.revokeObjectURL(url);
        resolve(dims);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  return null;
}

