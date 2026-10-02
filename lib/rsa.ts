/**
 * rsa.ts — RSA key pair generation and AES session key wrapping / unwrapping.
 *
 * Uses Node's crypto module with 2048-bit RSA keys and RSA-OAEP padding with SHA-256.
 */
import crypto from "crypto";

export interface RSAKeyPair {
  publicKey: string;
  privateKey: string;
}

/**
 * Generate a 2048-bit RSA key pair in PEM format.
 * Public key: SPKI PEM
 * Private key: PKCS#8 PEM
 */
export function generateKeyPair(): RSAKeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  return { publicKey, privateKey };
}

/**
 * Wrap (encrypt) a symmetric AES key buffer with the recipient's RSA public key using RSA-OAEP.
 */
export function wrapAESKey(aesKey: Buffer, publicKeyPem: string): Buffer {
  try {
    return crypto.publicEncrypt(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      aesKey
    );
  } catch (err) {
    throw new Error(
      `Failed to wrap AES key with RSA public key: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Unwrap (decrypt) a wrapped AES key buffer using the recipient's RSA private key.
 */
export function unwrapAESKey(wrappedKey: Buffer, privateKeyPem: string): Buffer {
  try {
    return crypto.privateDecrypt(
      {
        key: privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      wrappedKey
    );
  } catch (err) {
    throw new Error(
      `Failed to unwrap AES key with RSA private key: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
