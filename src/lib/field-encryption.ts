// Field-level encryption for the most sensitive columns (AES-256-GCM).
//
// Stored form:  enc:v1:<keyId>:<Model.field>:<base64(iv | tag | ciphertext)>
//   keyId        first 8 hex chars of SHA-256(key), so a rotated key can still read old values
//   Model.field  used as authenticated data, so a ciphertext copied into another column fails to decrypt
//
// Keys: FIELD_ENCRYPTION_KEY (current, 32 bytes as base64) and optionally
// FIELD_ENCRYPTION_KEY_PREVIOUS (still readable, never used to write).
// Without a key, development and tests store plain text; production refuses (fails closed).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Columns that are encrypted. Reads decrypt them wherever they appear in a result. */
export const ENCRYPTED_FIELDS: Record<string, string[]> = {
  User: ["phone"],
  Society: ["upiId"],
  UpiChangeRequest: ["oldUpiId", "newUpiId"],
};

export class FieldEncryptionError extends Error {}

interface Key {
  id: string;
  key: Buffer;
}

function parseKey(raw: string | undefined, name: string): Key | null {
  if (!raw) return null;
  const key = Buffer.from(raw.trim(), "base64");
  if (key.length !== 32) {
    throw new FieldEncryptionError(`${name} must be 32 bytes encoded as base64 (generate one with: openssl rand -base64 32)`);
  }
  return { id: createHash("sha256").update(key).digest("hex").slice(0, 8), key };
}

function keys(): { current: Key | null; all: Key[] } {
  const current = parseKey(process.env.FIELD_ENCRYPTION_KEY, "FIELD_ENCRYPTION_KEY");
  const previous = parseKey(process.env.FIELD_ENCRYPTION_KEY_PREVIOUS, "FIELD_ENCRYPTION_KEY_PREVIOUS");
  return { current, all: [current, previous].filter((k): k is Key => k !== null) };
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** Which key a stored value was written with, or null if it is plain text. */
export function keyIdOf(value: string): string | null {
  return isEncrypted(value) ? (value.split(":")[2] ?? null) : null;
}

export function currentKeyId(): string | null {
  return keys().current?.id ?? null;
}

export function encryptValue(plain: string, field: string): string {
  if (isEncrypted(plain)) return plain; // already encrypted: never double-encrypt
  const { current } = keys();
  if (!current) {
    if (process.env.NODE_ENV === "production") {
      throw new FieldEncryptionError("FIELD_ENCRYPTION_KEY is not set; refusing to store sensitive data unencrypted");
    }
    return plain;
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", current.key, iv);
  cipher.setAAD(Buffer.from(field));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const packed = Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
  return `${PREFIX}${current.id}:${field}:${packed}`;
}

/** Plain text passes through unchanged; encrypted values are decrypted or an error is thrown. */
export function decryptValue(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  const [, , keyId, field, packed] = stored.split(":");
  if (!keyId || !field || !packed) throw new FieldEncryptionError("Malformed encrypted value");
  const key = keys().all.find((k) => k.id === keyId);
  if (!key) throw new FieldEncryptionError(`No encryption key matches ${keyId}. Is FIELD_ENCRYPTION_KEY set to the key used to write this data?`);
  const raw = Buffer.from(packed, "base64");
  if (raw.length < IV_BYTES + TAG_BYTES) throw new FieldEncryptionError("Malformed encrypted value");
  const decipher = createDecipheriv("aes-256-gcm", key.key, raw.subarray(0, IV_BYTES));
  decipher.setAAD(Buffer.from(field));
  decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  try {
    return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
  } catch {
    throw new FieldEncryptionError("Could not decrypt: the value was altered or moved to another column");
  }
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && Object.getPrototypeOf(v) === Object.prototype;

/** Decrypt every encrypted string inside a query result (rows, arrays, nested relations). */
export function decryptDeep<T>(value: T): T {
  if (typeof value === "string") return (isEncrypted(value) ? decryptValue(value) : value) as T;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = decryptDeep(value[i]);
    return value;
  }
  if (isPlainObject(value)) {
    const obj: Record<string, unknown> = value;
    for (const k of Object.keys(obj)) obj[k] = decryptDeep(obj[k]);
  }
  return value; // Dates, Decimals and other class instances are left alone
}

// ── Writes ──────────────────────────────────────────────

/** Relations through which a nested write can reach an encrypted model. */
const RELATIONS: Record<string, Record<string, string>> = {
  Society: { users: "User", upiChangeRequests: "UpiChangeRequest" },
  User: { society: "Society" },
};

function encryptRecord(model: string, data: unknown): void {
  if (Array.isArray(data)) return void data.forEach((d) => encryptRecord(model, d));
  if (!isPlainObject(data)) return;
  const fields = ENCRYPTED_FIELDS[model] ?? [];
  const relations = RELATIONS[model] ?? {};

  for (const key of Object.keys(data)) {
    const value = data[key];
    if (fields.includes(key)) {
      if (typeof value === "string" && value !== "") data[key] = encryptValue(value, `${model}.${key}`);
      // `{ set: "…" }` is the long form of an update
      else if (isPlainObject(value) && typeof value.set === "string" && value.set !== "") {
        value.set = encryptValue(value.set, `${model}.${key}`);
      }
    } else if (relations[key]) {
      encryptNested(relations[key], value);
    }
  }
}

function encryptNested(model: string, op: unknown): void {
  if (!isPlainObject(op)) return;
  for (const [k, v] of Object.entries(op)) {
    if (k === "create" || k === "update" || k === "data") encryptRecord(model, isPlainObject(v) && "data" in v ? (v as { data: unknown }).data : v);
    else if (k === "createMany" && isPlainObject(v)) encryptRecord(model, v.data);
    else if (k === "upsert" || k === "connectOrCreate") {
      if (isPlainObject(v)) {
        encryptRecord(model, v.create);
        encryptRecord(model, v.update);
      }
    } else if (k === "updateMany" && isPlainObject(v)) encryptRecord(model, v.data);
  }
}

/** Encrypt the sensitive fields in the arguments of a write operation, in place. */
export function encryptWriteArgs(model: string, operation: string, args: unknown): void {
  if (!isPlainObject(args)) return;
  if (["create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn"].includes(operation)) {
    encryptRecord(model, args.data);
  } else if (operation === "upsert") {
    encryptRecord(model, args.create);
    encryptRecord(model, args.update);
  }
}
