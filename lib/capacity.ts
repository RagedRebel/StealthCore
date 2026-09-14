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
