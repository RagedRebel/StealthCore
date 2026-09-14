/**
 * crypto.ts — AES-256-GCM authenticated encryption with PBKDF2 key derivation.
 *
 * Binary pack format:
 *   [Salt: 16 bytes][IV: 12 bytes][AuthTag: 16 bytes][Ciphertext: N bytes]
 */
import crypto from "crypto";

// ─── Constants ───────────────────────────────────────────────────────────────

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits — recommended for GCM
const SALT_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_DIGEST = "sha256";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EncryptedPayload {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  salt: Buffer;
}

// ─── Custom Error ────────────────────────────────────────────────────────────

export class AuthenticationError extends Error {
  constructor(
    message = "Data has been tampered with or password is incorrect"
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

// ─── Key Derivation ──────────────────────────────────────────────────────────

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    PBKDF2_DIGEST
  );
}

// ─── Encrypt ─────────────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext Buffer with a password using AES-256-GCM.
 */
export function encryptPayload(
  data: Buffer,
  password: string
): EncryptedPayload {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(password, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return { ciphertext, iv, authTag, salt };
}

// ─── Decrypt ─────────────────────────────────────────────────────────────────

/**
 * Decrypt ciphertext with the matching password, IV, authTag, and salt.
 * Throws AuthenticationError if the auth tag verification fails.
 */
export function decryptPayload(
  ciphertext: Buffer,
  iv: Buffer,
  authTag: Buffer,
  salt: Buffer,
  password: string
): Buffer {
  const key = deriveKey(password, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  try {
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext;
  } catch {
    throw new AuthenticationError();
  }
}

// ─── Binary Pack / Unpack Helpers ────────────────────────────────────────────

/**
 * Pack all encrypted components into a single contiguous Buffer.
 * Layout: [salt:16][iv:12][authTag:16][ciphertext:N]
 */
export function packEncrypted(payload: EncryptedPayload): Buffer {
  return Buffer.concat([
    payload.salt,
    payload.iv,
    payload.authTag,
    payload.ciphertext,
  ]);
}

/**
 * Unpack a packed encrypted Buffer back into its components.
 */
export function unpackEncrypted(packed: Buffer): EncryptedPayload {
  let offset = 0;

  const salt = packed.subarray(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;

  const iv = packed.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;

  const authTag = packed.subarray(offset, offset + AUTH_TAG_LENGTH);
  offset += AUTH_TAG_LENGTH;

  const ciphertext = packed.subarray(offset);

  return { salt, iv, authTag, ciphertext };
}
