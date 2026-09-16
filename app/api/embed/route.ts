/**
 * POST /api/embed — Embed a secret file into a cover PNG image.
 *
 * Accepts multipart form data:
 *   - coverImage: PNG file
 *   - secretFile: any file
 *   - password: string
 *
 * Pipeline: serialize → encrypt → pack → check capacity → embed → return stego PNG
 */
import { NextRequest } from "next/server";
import { serializeFile } from "@/lib/serialize";
import { encryptPayload, packEncrypted } from "@/lib/crypto";
import { embedLSB } from "@/lib/steganography";
import { checkCapacity } from "@/lib/capacity";
import { PNG } from "pngjs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // ─── Extract Fields ────────────────────────────────────────────────
    const coverImageFile = formData.get("coverImage") as File | null;
    const secretFile = formData.get("secretFile") as File | null;
    const password = formData.get("password") as string | null;

    // ─── Validate Inputs ───────────────────────────────────────────────
    if (!coverImageFile) {
      return Response.json(
        { error: "Cover image is required" },
        { status: 400 }
      );
    }
    if (!secretFile) {
      return Response.json(
        { error: "Secret file is required" },
        { status: 400 }
      );
    }
    if (!password || password.length === 0) {
      return Response.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    // ─── Validate PNG Format ───────────────────────────────────────────
    if (
      coverImageFile.type !== "image/png" &&
      !coverImageFile.name.toLowerCase().endsWith(".png")
    ) {
      return Response.json(
        {
          error:
            "Cover image must be a PNG file. JPEG and other lossy formats will corrupt the hidden data.",
        },
        { status: 400 }
      );
    }

    // ─── Read File Buffers ─────────────────────────────────────────────
    const coverImageBuffer = Buffer.from(await coverImageFile.arrayBuffer());
    const secretBuffer = Buffer.from(await secretFile.arrayBuffer());
    const secretFilename = secretFile.name;

    // ─── Parse cover PNG to verify it and get dimensions ───────────────
    let coverPng: PNG;
    try {
      coverPng = PNG.sync.read(coverImageBuffer);
    } catch {
      return Response.json(
        { error: "Failed to parse cover image. Please ensure it is a valid PNG file." },
        { status: 400 }
      );
    }

    // ─── Pipeline ──────────────────────────────────────────────────────

    // 1. Serialize: wrap secret file with filename metadata
    const serialized = serializeFile(secretBuffer, secretFilename);

    // 2. Encrypt: AES-256-GCM
    const encrypted = encryptPayload(serialized, password);
    const packed = packEncrypted(encrypted);

    // 3. Check capacity
    const capacityResult = checkCapacity(
      packed.length,
      coverPng.width,
      coverPng.height
    );

    if (!capacityResult.fits) {
      return Response.json(
        {
          error: `Secret file is too large for this cover image. Payload: ${formatBytes(packed.length)}, Maximum capacity: ${formatBytes(capacityResult.maxBytes)}.`,
          maxBytes: capacityResult.maxBytes,
          payloadBytes: packed.length,
        },
        { status: 400 }
      );
    }

    // 4. Embed into cover image
    const stegoBuffer = embedLSB(coverImageBuffer, packed);

    // ─── Return Stego PNG ──────────────────────────────────────────────
    return new Response(new Uint8Array(stegoBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="stego_${coverImageFile.name}"`,
        "Content-Length": stegoBuffer.length.toString(),
      },
    });
  } catch (err) {
    console.error("Embed error:", err);
    return Response.json(
      { error: "An unexpected error occurred during embedding." },
      { status: 500 }
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
