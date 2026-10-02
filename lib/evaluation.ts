/**
 * evaluation.ts — Image quality evaluation module using PSNR and SSIM.
 */
import { PNG } from "pngjs";

export interface EvaluationResult {
  psnr: number;
  ssim: number;
}

/**
 * Validate that two PNG images have matching dimensions.
 * Throws an Error if dimensions differ or if images cannot be parsed.
 */
function parseAndValidatePair(
  coverImageBuffer: Buffer,
  stegoImageBuffer: Buffer
): { coverPng: PNG; stegoPng: PNG } {
  let coverPng: PNG;
  let stegoPng: PNG;

  try {
    coverPng = PNG.sync.read(coverImageBuffer);
  } catch (err) {
    throw new Error(
      `Failed to parse cover image PNG: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  try {
    stegoPng = PNG.sync.read(stegoImageBuffer);
  } catch (err) {
    throw new Error(
      `Failed to parse stego image PNG: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (coverPng.width !== stegoPng.width || coverPng.height !== stegoPng.height) {
    throw new Error(
      `Image dimensions do not match: cover is ${coverPng.width}x${coverPng.height}, but stego is ${stegoPng.width}x${stegoPng.height}`
    );
  }

  return { coverPng, stegoPng };
}

/**
 * Calculate Peak Signal-to-Noise Ratio (PSNR) between cover and stego PNGs.
 * Computes Mean Squared Error (MSE) across R, G, B channels.
 * Formula: PSNR = 10 * log10(255^2 / MSE).
 * Returns Infinity if MSE is 0.
 */
export function calculatePSNR(
  coverImageBuffer: Buffer,
  stegoImageBuffer: Buffer
): number {
  const { coverPng, stegoPng } = parseAndValidatePair(
    coverImageBuffer,
    stegoImageBuffer
  );

  const { width, height } = coverPng;
  const totalPixels = width * height;
  if (totalPixels === 0) {
    return Infinity;
  }

  const coverData = coverPng.data;
  const stegoData = stegoPng.data;

  let sumSquaredError = 0;
  // Loop over pixels, check R, G, B channels (stride 4, skip Alpha)
  for (let px = 0; px < totalPixels; px++) {
    const baseIdx = px * 4;
    const diffR = coverData[baseIdx] - stegoData[baseIdx];
    const diffG = coverData[baseIdx + 1] - stegoData[baseIdx + 1];
    const diffB = coverData[baseIdx + 2] - stegoData[baseIdx + 2];

    sumSquaredError += diffR * diffR + diffG * diffG + diffB * diffB;
  }

  // MSE across all color channels (3 channels per pixel)
  const mse = sumSquaredError / (totalPixels * 3);

  if (mse === 0) {
    return Infinity;
  }

  const psnr = 10 * Math.log10((255 * 255) / mse);
  return Number(psnr.toFixed(4));
}

/**
 * Convert RGBA pixel buffer to 8-bit grayscale luminance array (Y = 0.299*R + 0.587*G + 0.114*B).
 */
function toGrayscale(png: PNG): Float64Array {
  const { width, height, data } = png;
  const totalPixels = width * height;
  const gray = new Float64Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const base = i * 4;
    gray[i] =
      0.299 * data[base] + 0.587 * data[base + 1] + 0.114 * data[base + 2];
  }

  return gray;
}

/**
 * Calculate Structural Similarity Index (SSIM) between cover and stego PNGs.
 * Uses windowed comparison over luminance channel with standard 8x8 windows.
 * Constants:
 *   C1 = (0.01 * 255)^2 = 6.5025
 *   C2 = (0.03 * 255)^2 = 58.5225
 */
export function calculateSSIM(
  coverImageBuffer: Buffer,
  stegoImageBuffer: Buffer
): number {
  const { coverPng, stegoPng } = parseAndValidatePair(
    coverImageBuffer,
    stegoImageBuffer
  );

  const { width, height } = coverPng;
  const totalPixels = width * height;
  if (totalPixels === 0) {
    return 1;
  }

  const grayCover = toGrayscale(coverPng);
  const grayStego = toGrayscale(stegoPng);

  const C1 = (0.01 * 255) ** 2; // 6.5025
  const C2 = (0.03 * 255) ** 2; // 58.5225

  const WINDOW_SIZE = 8;

  // Handle tiny images where width or height is less than WINDOW_SIZE
  if (width < WINDOW_SIZE || height < WINDOW_SIZE) {
    let meanX = 0;
    let meanY = 0;
    for (let i = 0; i < totalPixels; i++) {
      meanX += grayCover[i];
      meanY += grayStego[i];
    }
    meanX /= totalPixels;
    meanY /= totalPixels;

    let varX = 0;
    let varY = 0;
    let covXY = 0;
    for (let i = 0; i < totalPixels; i++) {
      const diffX = grayCover[i] - meanX;
      const diffY = grayStego[i] - meanY;
      varX += diffX * diffX;
      varY += diffY * diffY;
      covXY += diffX * diffY;
    }
    varX /= totalPixels;
    varY /= totalPixels;
    covXY /= totalPixels;

    const numerator = (2 * meanX * meanY + C1) * (2 * covXY + C2);
    const denominator = (meanX * meanX + meanY * meanY + C1) * (varX + varY + C2);
    return Number((numerator / denominator).toFixed(4));
  }

  // Windowed SSIM with step size = 4 for good spatial coverage & speed
  const step = 4;
  let totalSSIM = 0;
  let windowCount = 0;
  const N = WINDOW_SIZE * WINDOW_SIZE;

  for (let y = 0; y <= height - WINDOW_SIZE; y += step) {
    for (let x = 0; x <= width - WINDOW_SIZE; x += step) {
      let sumX = 0;
      let sumY = 0;

      for (let wy = 0; wy < WINDOW_SIZE; wy++) {
        const rowOffset = (y + wy) * width + x;
        for (let wx = 0; wx < WINDOW_SIZE; wx++) {
          const idx = rowOffset + wx;
          sumX += grayCover[idx];
          sumY += grayStego[idx];
        }
      }

      const meanX = sumX / N;
      const meanY = sumY / N;

      let varX = 0;
      let varY = 0;
      let covXY = 0;

      for (let wy = 0; wy < WINDOW_SIZE; wy++) {
        const rowOffset = (y + wy) * width + x;
        for (let wx = 0; wx < WINDOW_SIZE; wx++) {
          const idx = rowOffset + wx;
          const diffX = grayCover[idx] - meanX;
          const diffY = grayStego[idx] - meanY;
          varX += diffX * diffX;
          varY += diffY * diffY;
          covXY += diffX * diffY;
        }
      }

      varX /= N;
      varY /= N;
      covXY /= N;

      const num = (2 * meanX * meanY + C1) * (2 * covXY + C2);
      const den = (meanX * meanX + meanY * meanY + C1) * (varX + varY + C2);
      totalSSIM += num / den;
      windowCount++;
    }
  }

  const ssim = windowCount > 0 ? totalSSIM / windowCount : 1;
  return Number(ssim.toFixed(4));
}

/**
 * Evaluate both PSNR and SSIM for a cover/stego PNG pair.
 */
export function evaluateStego(
  coverImageBuffer: Buffer,
  stegoImageBuffer: Buffer
): EvaluationResult {
  const psnr = calculatePSNR(coverImageBuffer, stegoImageBuffer);
  const ssim = calculateSSIM(coverImageBuffer, stegoImageBuffer);
  return { psnr, ssim };
}
