/**
 * POST /api/extract — Extract a hidden file from a stego PNG image.
 *
 * Accepts multipart form data:
 *   - stegoImage: PNG file containing hidden data
 *   - password?: string (used if privateKey is not provided)
 *   - privateKey?: string (RSA private key PEM)
 *
 * Pipeline: extract bits → unpack (RSA or password) → decrypt (verify auth tag) → deserialize → return original file
 */
import { NextRequest } from "next/server";
import { deserializeFile } from "@/lib/serialize";
import {
  decryptPayloadPassword,
  unpackEncrypted,
  decryptPayloadRSA,
  unpackEncryptedRSA,
  AuthenticationError,
} from "@/lib/crypto";
import { extractLSB } from "@/lib/steganography";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // ─── Extract Fields ────────────────────────────────────────────────
    const stegoImageFile = formData.get("stegoImage") as File | null;
    const password = (formData.get("password") as string | null)?.trim() || null;
    const privateKey = (formData.get("privateKey") as string | null)?.trim() || null;

    // ─── Validate Inputs ───────────────────────────────────────────────
    if (!stegoImageFile) {
      return Response.json(
        { error: "Stego image is required" },
        { status: 400 }
      );
    }
    if (!privateKey && !password) {
      return Response.json(
        { error: "Either an RSA private key or a decryption password is required." },
        { status: 400 }
      );
    }

    if (privateKey && !privateKey.includes("PRIVATE KEY")) {
      return Response.json(
        { error: "Invalid RSA private key. Please provide a valid PEM-formatted private key." },
        { status: 400 }
      );
    }

    // ─── Validate PNG Format ───────────────────────────────────────────
    if (
      stegoImageFile.type !== "image/png" &&
      !stegoImageFile.name.toLowerCase().endsWith(".png")
    ) {
      return Response.json(
        {
          error:
            "Stego image must be a PNG file. Other formats will have corrupted the hidden data.",
        },
        { status: 400 }
      );
    }

    // ─── Read File Buffer ──────────────────────────────────────────────
    const stegoBuffer = Buffer.from(await stegoImageFile.arrayBuffer());

    // ─── Pipeline ──────────────────────────────────────────────────────

    // 1. Extract embedded bits from stego image
    let extractedPacked: Buffer;
    try {
      extractedPacked = extractLSB(stegoBuffer);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown extraction error";
      return Response.json(
        {
          error: `Failed to extract hidden data. This image may not contain any embedded data. Details: ${message}`,
        },
        { status: 400 }
      );
    }

    // 2. Unpack & Decrypt (AES-256-GCM — verifies auth tag)
    let decryptedSerialized: Buffer;
    try {
      if (privateKey) {
        const unpacked = unpackEncryptedRSA(extractedPacked);
        decryptedSerialized = decryptPayloadRSA(
          unpacked.ciphertext,
          unpacked.iv,
          unpacked.authTag,
          unpacked.wrappedKey,
          privateKey
        );
      } else {
        const unpacked = unpackEncrypted(extractedPacked);
        decryptedSerialized = decryptPayloadPassword(
          unpacked.ciphertext,
          unpacked.iv,
          unpacked.authTag,
          unpacked.salt,
          password!
        );
      }
    } catch (err) {
      if (err instanceof AuthenticationError) {
        return Response.json(
          {
            error:
              "Data has been tampered with or key/password is incorrect. Authentication tag verification failed.",
            code: "AUTH_FAILED",
          },
          { status: 401 }
        );
      }
      throw err;
    }

    // 3. Deserialize to recover original filename and data
    let recovered: { filename: string; data: Buffer };
    try {
      recovered = deserializeFile(decryptedSerialized);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown deserialization error";
      return Response.json(
        {
          error: `Failed to reconstruct the hidden file. The data may be corrupted. Details: ${message}`,
        },
        { status: 400 }
      );
    }

    // ─── Return Recovered File ─────────────────────────────────────────
    const ext = recovered.filename.split(".").pop()?.toLowerCase() || "";
    const mimeType = getMimeType(ext);

    return new Response(new Uint8Array(recovered.data), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${recovered.filename}"`,
        "Content-Length": recovered.data.length.toString(),
        "X-Original-Filename": recovered.filename,
      },
    });
  } catch (err) {
    console.error("Extract error:", err);
    return Response.json(
      { error: "An unexpected error occurred during extraction." },
      { status: 500 }
    );
  }
}

function getMimeType(ext: string): string {
  const mimeMap: Record<string, string> = {
    txt: "text/plain",
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    zip: "application/zip",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    wav: "audio/wav",
  };
  return mimeMap[ext] || "application/octet-stream";
}
