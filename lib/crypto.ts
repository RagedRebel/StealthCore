/**
 * crypto.ts — AES-256-GCM authenticated encryption with PBKDF2 key derivation or RSA key-wrapping.
 *
 * Binary pack format (Password-derived):
 *   [Salt: 16 bytes][IV: 12 bytes][AuthTag: 16 bytes][Ciphertext: N bytes]
 *
 * Binary pack format (RSA session key):
 *   [WrappedKeyLen: 2 bytes uint16 BE][WrappedKey: N1 bytes]
 *   [IVLen: 2 bytes uint16 BE][IV: N2 bytes]
 *   [CiphertextLen: 4 bytes uint32 BE][Ciphertext: N3 bytes]
 *   [AuthTagLen: 2 bytes uint16 BE][AuthTag: N4 bytes]
 */
import crypto from "crypto";
import { wrapAESKey, unwrapAESKey } from "./rsa";

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

export interface EncryptedPayloadRSA {
  wrappedKey: Buffer;
  iv: Buffer;
  authTag: Buffer;
  ciphertext: Buffer;
}

// ─── Custom Error ────────────────────────────────────────────────────

export class AuthenticationError extends Error {
  constructor(
    message = "Data has been tampered with or password/key is incorrect"
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

// ─── Password-based Encrypt / Decrypt ────────────────────────────────────────

/**
 * Encrypt a plaintext Buffer with a password using AES-256-GCM.
 */
export function encryptPayloadPassword(
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

/**
 * Decrypt ciphertext with password, IV, authTag, and salt.
 * Throws AuthenticationError if auth tag verification fails.
 */
export function decryptPayloadPassword(
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

// ─── RSA-based Encrypt / Decrypt ─────────────────────────────────────────────

/**
 * Encrypt a plaintext Buffer with an ephemeral AES-256 session key,
 * then wrap the session key with the receiver's RSA public key using RSA-OAEP.
 */
export function encryptPayloadRSA(
  data: Buffer,
  publicKeyPem: string
): EncryptedPayloadRSA {
  const sessionKey = crypto.randomBytes(KEY_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, sessionKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const wrappedKey = wrapAESKey(sessionKey, publicKeyPem);

  return { wrappedKey, iv, authTag, ciphertext };
}

/**
 * Decrypt ciphertext by unwrapping the AES session key using the receiver's RSA private key,
 * then AES-GCM decrypting.
 * Throws AuthenticationError if key unwrapping or auth tag verification fails.
 */
export function decryptPayloadRSA(
  ciphertext: Buffer,
  iv: Buffer,
  authTag: Buffer,
  wrappedKey: Buffer,
  privateKeyPem: string
): Buffer {
  let sessionKey: Buffer;
  try {
    sessionKey = unwrapAESKey(wrappedKey, privateKeyPem);
  } catch {
    throw new AuthenticationError("Failed to unwrap session key. Private key is invalid or mismatched.");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, sessionKey, iv, {
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

// ─── Unified Polymorphic Encrypt / Decrypt ───────────────────────────────────

/**
 * Encrypt payload using either an RSA public key or a password.
 * Automatically delegates based on whether keyOrPassword contains an RSA public key PEM header.
 */
export function encryptPayload(
  data: Buffer,
  keyOrPassword: string
): EncryptedPayload | EncryptedPayloadRSA {
  if (keyOrPassword.includes("PUBLIC KEY")) {
    return encryptPayloadRSA(data, keyOrPassword);
  }
  return encryptPayloadPassword(data, keyOrPassword);
}

/**
 * Decrypt payload using either an RSA private key or a password.
 */
export function decryptPayload(
  ciphertext: Buffer,
  iv: Buffer,
  authTag: Buffer,
  saltOrWrappedKey: Buffer,
  passwordOrPrivateKey: string
): Buffer {
  if (passwordOrPrivateKey.includes("PRIVATE KEY")) {
    return decryptPayloadRSA(
      ciphertext,
      iv,
      authTag,
      saltOrWrappedKey,
      passwordOrPrivateKey
    );
  }
  return decryptPayloadPassword(
    ciphertext,
    iv,
    authTag,
    saltOrWrappedKey,
    passwordOrPrivateKey
  );
}

// ─── Binary Pack / Unpack Helpers (Password) ─────────────────────────────────

/**
 * Pack password-encrypted components into a contiguous Buffer.
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
 * Unpack a password-encrypted packed Buffer.
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

// ─── Binary Pack / Unpack Helpers (RSA) ──────────────────────────────────────

/**
 * Pack RSA-encrypted components into a length-prefixed Buffer:
 *   [wrappedKeyLen: 2 bytes uint16 BE][wrappedKey: N1 bytes]
 *   [ivLen: 2 bytes uint16 BE][iv: N2 bytes]
 *   [ciphertextLen: 4 bytes uint32 BE][ciphertext: N3 bytes]
 *   [authTagLen: 2 bytes uint16 BE][authTag: N4 bytes]
 */
export function packEncryptedRSA(payload: EncryptedPayloadRSA): Buffer {
  const wrappedKeyLen = Buffer.alloc(2);
  wrappedKeyLen.writeUInt16BE(payload.wrappedKey.length, 0);

  const ivLen = Buffer.alloc(2);
  ivLen.writeUInt16BE(payload.iv.length, 0);

  const ciphertextLen = Buffer.alloc(4);
  ciphertextLen.writeUInt32BE(payload.ciphertext.length, 0);

  const authTagLen = Buffer.alloc(2);
  authTagLen.writeUInt16BE(payload.authTag.length, 0);

  return Buffer.concat([
    wrappedKeyLen,
    payload.wrappedKey,
    ivLen,
    payload.iv,
    ciphertextLen,
    payload.ciphertext,
    authTagLen,
    payload.authTag,
  ]);
}

/**
 * Unpack a length-prefixed RSA-encrypted packed Buffer.
 */
export function unpackEncryptedRSA(packed: Buffer): EncryptedPayloadRSA {
  try {
    let offset = 0;

    if (packed.length < 2) {
      throw new AuthenticationError("Buffer too short to contain wrappedKey length header");
    }
    const wrappedKeyLength = packed.readUInt16BE(offset);
    offset += 2;

    if (packed.length < offset + wrappedKeyLength) {
      throw new AuthenticationError("Buffer too short to contain wrappedKey");
    }
    const wrappedKey = packed.subarray(offset, offset + wrappedKeyLength);
    offset += wrappedKeyLength;

    if (packed.length < offset + 2) {
      throw new AuthenticationError("Buffer too short to contain IV length header");
    }
    const ivLength = packed.readUInt16BE(offset);
    offset += 2;

    if (packed.length < offset + ivLength) {
      throw new AuthenticationError("Buffer too short to contain IV");
    }
    const iv = packed.subarray(offset, offset + ivLength);
    offset += ivLength;

    if (packed.length < offset + 4) {
      throw new AuthenticationError("Buffer too short to contain ciphertext length header");
    }
    const ciphertextLength = packed.readUInt32BE(offset);
    offset += 4;

    if (packed.length < offset + ciphertextLength) {
      throw new AuthenticationError("Buffer too short to contain ciphertext");
    }
    const ciphertext = packed.subarray(offset, offset + ciphertextLength);
    offset += ciphertextLength;

    if (packed.length < offset + 2) {
      throw new AuthenticationError("Buffer too short to contain authTag length header");
    }
    const authTagLength = packed.readUInt16BE(offset);
    offset += 2;

    if (packed.length < offset + authTagLength) {
      throw new AuthenticationError("Buffer too short to contain authTag");
    }
    const authTag = packed.subarray(offset, offset + authTagLength);

    return { wrappedKey, iv, ciphertext, authTag };
  } catch (err) {
    if (err instanceof AuthenticationError) {
      throw err;
    }
    throw new AuthenticationError("Data has been tampered with or corrupted");
  }
}
