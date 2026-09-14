/**
 * serialize.ts — Binary serialization of a file with its original filename.
 *
 * Wire format:
 *   [FilenameLength: 2 bytes uint16 BE][Filename: UTF-8][DataLength: 4 bytes uint32 BE][Data: N bytes]
 *
 * Maximum filename length: 65 535 bytes (uint16).
 * Maximum data length: 4 294 967 295 bytes (~4 GB, uint32).
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DeserializedFile {
  filename: string;
  data: Buffer;
}

// ─── Serialize ───────────────────────────────────────────────────────────────

/**
 * Pack a file's raw bytes together with its original filename into a single Buffer.
 */
export function serializeFile(data: Buffer, filename: string): Buffer {
  const nameBytes = Buffer.from(filename, "utf-8");

  if (nameBytes.length > 0xffff) {
    throw new Error(`Filename is too long (${nameBytes.length} bytes, max 65535)`);
  }

  // 2-byte filename length header
  const nameLen = Buffer.alloc(2);
  nameLen.writeUInt16BE(nameBytes.length, 0);

  // 4-byte data length header
  const dataLen = Buffer.alloc(4);
  dataLen.writeUInt32BE(data.length, 0);

  return Buffer.concat([nameLen, nameBytes, dataLen, data]);
}

// ─── Deserialize ─────────────────────────────────────────────────────────────

/**
 * Unpack a serialized Buffer back into the original filename and raw data.
 */
export function deserializeFile(buffer: Buffer): DeserializedFile {
  let offset = 0;

  // Read filename length (2 bytes)
  if (buffer.length < 2) {
    throw new Error("Buffer too short to contain filename length header");
  }
  const nameLength = buffer.readUInt16BE(offset);
  offset += 2;

  // Read filename
  if (buffer.length < offset + nameLength) {
    throw new Error("Buffer too short to contain filename");
  }
  const filename = buffer.subarray(offset, offset + nameLength).toString("utf-8");
  offset += nameLength;

  // Read data length (4 bytes)
  if (buffer.length < offset + 4) {
    throw new Error("Buffer too short to contain data length header");
  }
  const dataLength = buffer.readUInt32BE(offset);
  offset += 4;

  // Read data
  if (buffer.length < offset + dataLength) {
    throw new Error(
      `Buffer too short to contain file data (expected ${dataLength} bytes, have ${buffer.length - offset})`
    );
  }
  const data = buffer.subarray(offset, offset + dataLength);

  return { filename, data };
}
