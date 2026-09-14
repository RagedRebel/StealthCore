/**
 * steganography.ts — Least Significant Bit (LSB) steganography on lossless PNG images.
 *
 * Uses pngjs for raw pixel buffer access.
 * Embeds data into the least significant bit of R, G, B channels (skips Alpha).
 *
 * Stego payload layout in pixel stream:
 *   [Payload Length: 32 bits (uint32 BE)][Payload Data: N × 8 bits]
 */
import { PNG } from "pngjs";

// ─── Constants ───────────────────────────────────────────────────────────────

const LENGTH_HEADER_BITS = 32; // 4-byte uint32 header

// ─── Bit Conversion Helpers ──────────────────────────────────────────────────

/**
 * Convert a Buffer into a Uint8Array of individual bits (0 or 1), MSB first per byte.
 */
export function bufferToBits(buf: Buffer): Uint8Array {
  const bits = new Uint8Array(buf.length * 8);
  for (let i = 0; i < buf.length; i++) {
    for (let b = 7; b >= 0; b--) {
      bits[i * 8 + (7 - b)] = (buf[i] >> b) & 1;
    }
  }
  return bits;
}

/**
 * Convert a Uint8Array of individual bits back into a Buffer, MSB first per byte.
 */
export function bitsToBuffer(bits: Uint8Array): Buffer {
  const byteCount = Math.ceil(bits.length / 8);
  const buf = Buffer.alloc(byteCount);
  for (let i = 0; i < byteCount; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      const idx = i * 8 + b;
      if (idx < bits.length) {
        byte = (byte << 1) | bits[idx];
      } else {
        byte = byte << 1;
      }
    }
    buf[i] = byte;
  }
  return buf;
}

// ─── PNG Helpers ─────────────────────────────────────────────────────────────

/**
 * Parse a PNG buffer into a pngjs PNG instance (synchronous).
 */
function parsePNG(pngBuffer: Buffer): PNG {
  return PNG.sync.read(pngBuffer);
}

/**
 * Encode a pngjs PNG instance back to a PNG buffer (synchronous).
 */
function encodePNG(png: PNG): Buffer {
  return PNG.sync.write(png);
}

// ─── Embed ───────────────────────────────────────────────────────────────────

/**
 * Embed a payload into a cover PNG image using LSB steganography.
 *
 * @param coverImageBuffer — raw PNG file bytes of the cover image.
 * @param payload — the raw bytes to embed.
 * @returns — the modified PNG file bytes (stego image).
 */
export function embedLSB(coverImageBuffer: Buffer, payload: Buffer): Buffer {
  const png = parsePNG(coverImageBuffer);
  const { width, height, data } = png; // data = RGBA pixel buffer

  // Build the bit stream: [32-bit length header][payload bits]
  const lengthHeader = Buffer.alloc(4);
  lengthHeader.writeUInt32BE(payload.length, 0);

  const headerBits = bufferToBits(lengthHeader);
  const payloadBits = bufferToBits(payload);
  const totalBits = new Uint8Array(headerBits.length + payloadBits.length);
  totalBits.set(headerBits, 0);
  totalBits.set(payloadBits, headerBits.length);

  // Calculate available bit slots (R, G, B channels only — skip Alpha)
  const totalPixels = width * height;
  const availableBits = totalPixels * 3; // 1 bit per channel, 3 channels

  if (totalBits.length > availableBits) {
    throw new Error(
      `Payload too large: need ${totalBits.length} bits but image only supports ${availableBits} bits`
    );
  }

  // Embed bits into LSB of R, G, B channels
  let bitIdx = 0;
  for (let px = 0; px < totalPixels && bitIdx < totalBits.length; px++) {
    const baseIdx = px * 4; // RGBA stride

    // R channel
    if (bitIdx < totalBits.length) {
      data[baseIdx] = (data[baseIdx] & 0xfe) | totalBits[bitIdx];
      bitIdx++;
    }
    // G channel
    if (bitIdx < totalBits.length) {
      data[baseIdx + 1] = (data[baseIdx + 1] & 0xfe) | totalBits[bitIdx];
      bitIdx++;
    }
    // B channel
    if (bitIdx < totalBits.length) {
      data[baseIdx + 2] = (data[baseIdx + 2] & 0xfe) | totalBits[bitIdx];
      bitIdx++;
    }
    // Alpha (index + 3) is never touched
  }

  return encodePNG(png);
}

// ─── Extract ─────────────────────────────────────────────────────────────────

/**
 * Extract a hidden payload from a stego PNG image.
 *
 * @param stegoImageBuffer — raw PNG file bytes of the stego image.
 * @returns — the extracted raw payload bytes.
 */
export function extractLSB(stegoImageBuffer: Buffer): Buffer {
  const png = parsePNG(stegoImageBuffer);
  const { width, height, data } = png;
  const totalPixels = width * height;

  // Helper: read a single bit from the pixel data at bit position `bitPos`
  function readBit(bitPos: number): number {
    const px = Math.floor(bitPos / 3);
    const channel = bitPos % 3; // 0 = R, 1 = G, 2 = B
    const baseIdx = px * 4;
    return data[baseIdx + channel] & 1;
  }

  // Step 1: Read 32-bit length header
  const headerBits = new Uint8Array(LENGTH_HEADER_BITS);
  for (let i = 0; i < LENGTH_HEADER_BITS; i++) {
    headerBits[i] = readBit(i);
  }
  const lengthBuf = bitsToBuffer(headerBits);
  const payloadLength = lengthBuf.readUInt32BE(0);

  // Sanity check
  const maxPayloadBytes = Math.floor((totalPixels * 3 - LENGTH_HEADER_BITS) / 8);
  if (payloadLength > maxPayloadBytes || payloadLength < 0) {
    throw new Error(
      `Invalid payload length extracted (${payloadLength} bytes). The image may not contain hidden data.`
    );
  }

  // Step 2: Read payload bits
  const payloadBitCount = payloadLength * 8;
  const payloadBits = new Uint8Array(payloadBitCount);
  for (let i = 0; i < payloadBitCount; i++) {
    payloadBits[i] = readBit(LENGTH_HEADER_BITS + i);
  }

  return bitsToBuffer(payloadBits);
}
