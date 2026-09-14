/**
 * test-roundtrip.ts — End-to-end round-trip verification for StealthCore engine.
 *
 * Tests:
 *   1. Serialize → Deserialize (byte-for-byte match)
 *   2. Encrypt → Decrypt with correct password
 *   3. Decrypt with wrong password throws AuthenticationError
 *   4. Full pipeline: Serialize → Encrypt → Pack → Embed → Extract → Unpack → Decrypt → Deserialize
 *   5. Tamper detection (alter 1 byte in stego image → auth tag failure)
 *   6. Capacity check rejects oversized payload
 *
 * Run: npx tsx scripts/test-roundtrip.ts
 */
import { PNG } from "pngjs";
import { serializeFile, deserializeFile } from "../lib/serialize";
import {
  encryptPayload,
  decryptPayload,
  packEncrypted,
  unpackEncrypted,
  AuthenticationError,
} from "../lib/crypto";
import { embedLSB, extractLSB } from "../lib/steganography";
import { checkCapacity } from "../lib/capacity";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createTestPNG(width: number, height: number): Buffer {
  const png = new PNG({ width, height });
  // Fill with random pixel data so LSB changes are realistic
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) * 4;
      png.data[idx] = Math.floor(Math.random() * 256);     // R
      png.data[idx + 1] = Math.floor(Math.random() * 256); // G
      png.data[idx + 2] = Math.floor(Math.random() * 256); // B
      png.data[idx + 3] = 255;                              // A (opaque)
    }
  }
  return PNG.sync.write(png);
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

// ─── Test 1: Serialization Round-trip ────────────────────────────────────────

console.log("\n─── Test 1: Serialization Round-trip ───");
{
  const filename = "secret_document.pdf";
  const data = Buffer.from("Hello, this is a secret PDF content! 🔐", "utf-8");
  const serialized = serializeFile(data, filename);
  const result = deserializeFile(serialized);

  assert(result.filename === filename, "Filename preserved");
  assert(Buffer.compare(result.data, data) === 0, "Data byte-for-byte identical");
}

// ─── Test 2: Encryption Round-trip (correct password) ────────────────────────

console.log("\n─── Test 2: Encryption Round-trip (correct password) ───");
{
  const password = "super-secret-password-123!";
  const plaintext = Buffer.from("Top secret data that must be encrypted", "utf-8");

  const encrypted = encryptPayload(plaintext, password);
  const decrypted = decryptPayload(
    encrypted.ciphertext,
    encrypted.iv,
    encrypted.authTag,
    encrypted.salt,
    password
  );

  assert(Buffer.compare(decrypted, plaintext) === 0, "Decrypted matches plaintext");
}

// ─── Test 3: Decryption with wrong password ──────────────────────────────────

console.log("\n─── Test 3: Decryption with wrong password ───");
{
  const password = "correct-password";
  const wrongPassword = "wrong-password";
  const plaintext = Buffer.from("Sensitive payload", "utf-8");

  const encrypted = encryptPayload(plaintext, password);
  let threwAuthError = false;

  try {
    decryptPayload(
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.authTag,
      encrypted.salt,
      wrongPassword
    );
  } catch (err) {
    threwAuthError = err instanceof AuthenticationError;
  }

  assert(threwAuthError, "AuthenticationError thrown for wrong password");
}

// ─── Test 4: Full Pipeline Round-trip ────────────────────────────────────────

console.log("\n─── Test 4: Full Pipeline (Serialize → Encrypt → Embed → Extract → Decrypt → Deserialize) ───");
{
  const originalFilename = "test_image.png";
  const originalData = Buffer.from(
    "This is a test secret file with some binary content: \x00\x01\x02\xff\xfe\xfd",
    "binary"
  );
  const password = "roundtrip-test-pw!";

  // 1. Serialize
  const serialized = serializeFile(originalData, originalFilename);

  // 2. Encrypt
  const encrypted = encryptPayload(serialized, password);
  const packed = packEncrypted(encrypted);

  // 3. Create a large enough cover image
  const coverPNG = createTestPNG(200, 200); // 200×200 = 40,000 pixels = 15,000 bytes capacity

  // 4. Check capacity
  const cap = checkCapacity(packed.length, 200, 200);
  assert(cap.fits, `Capacity check passes (${packed.length} bytes / ${cap.maxBytes} max)`);

  // 5. Embed
  const stegoPNG = embedLSB(coverPNG, packed);

  // 6. Extract
  const extractedPacked = extractLSB(stegoPNG);

  // 7. Unpack
  const unpacked = unpackEncrypted(extractedPacked);

  // 8. Decrypt
  const decryptedSerialized = decryptPayload(
    unpacked.ciphertext,
    unpacked.iv,
    unpacked.authTag,
    unpacked.salt,
    password
  );

  // 9. Deserialize
  const result = deserializeFile(decryptedSerialized);

  assert(result.filename === originalFilename, "Filename recovered correctly");
  assert(
    Buffer.compare(result.data, originalData) === 0,
    "File data recovered byte-for-byte identical"
  );
}

// ─── Test 5: Tamper Detection ────────────────────────────────────────────────

console.log("\n─── Test 5: Tamper Detection ───");
{
  const password = "tamper-test-pw";
  const payload = Buffer.from("Do not tamper with me!", "utf-8");

  const encrypted = encryptPayload(payload, password);
  const packed = packEncrypted(encrypted);
  const coverPNG = createTestPNG(200, 200);
  const stegoPNG = embedLSB(coverPNG, packed);

  // Tamper: flip a bit within the actual payload region of the stego image
  const tmpPng = PNG.sync.read(stegoPNG);
  // Flip LSB of the R channel of pixel 20 — well within the payload region
  // (payload is ~88 bytes = ~704 bits = ~235 pixels)
  const targetPixel = 20;
  const targetIdx = targetPixel * 4; // R channel of pixel 20
  tmpPng.data[targetIdx] ^= 0x01; // flip LSB
  const tamperedStego = PNG.sync.write(tmpPng);

  const extractedPacked = extractLSB(tamperedStego);
  const unpacked = unpackEncrypted(extractedPacked);

  let threwAuthError = false;
  try {
    decryptPayload(
      unpacked.ciphertext,
      unpacked.iv,
      unpacked.authTag,
      unpacked.salt,
      password
    );
  } catch (err) {
    threwAuthError = err instanceof AuthenticationError;
  }

  assert(threwAuthError, "Tampered stego image triggers AuthenticationError");
}

// ─── Test 6: Capacity Rejection ──────────────────────────────────────────────

console.log("\n─── Test 6: Capacity Rejection ───");
{
  // Tiny image: 4×4 = 16 pixels = 6 bytes capacity
  const cap = checkCapacity(1000, 4, 4);
  assert(!cap.fits, `Oversized payload rejected (1000 bytes > ${cap.maxBytes} max)`);

  const cap2 = checkCapacity(1, 4, 4);
  assert(cap2.fits, `Small payload accepted (1 byte <= ${cap2.maxBytes} max)`);
}

// ─── Pack / Unpack Round-trip ────────────────────────────────────────────────

console.log("\n─── Test 7: Pack / Unpack Round-trip ───");
{
  const password = "pack-test";
  const data = Buffer.from("Pack test data", "utf-8");
  const encrypted = encryptPayload(data, password);
  const packed = packEncrypted(encrypted);
  const unpacked = unpackEncrypted(packed);

  assert(Buffer.compare(unpacked.salt, encrypted.salt) === 0, "Salt preserved");
  assert(Buffer.compare(unpacked.iv, encrypted.iv) === 0, "IV preserved");
  assert(Buffer.compare(unpacked.authTag, encrypted.authTag) === 0, "AuthTag preserved");
  assert(Buffer.compare(unpacked.ciphertext, encrypted.ciphertext) === 0, "Ciphertext preserved");
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(50)}`);
console.log(`  Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log(`${"═".repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
}
