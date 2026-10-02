/**
 * GET /api/generate-keys — Generate a new 2048-bit RSA key pair.
 */
import { generateKeyPair } from "@/lib/rsa";

export async function GET() {
  try {
    const keyPair = generateKeyPair();
    return Response.json(keyPair, { status: 200 });
  } catch (err) {
    console.error("Key generation error:", err);
    return Response.json(
      { error: "Failed to generate RSA key pair." },
      { status: 500 }
    );
  }
}
