import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomBytes } from "node:crypto";
import {
  FieldEncryptionError,
  currentKeyId,
  decryptDeep,
  decryptValue,
  encryptValue,
  encryptWriteArgs,
  isEncrypted,
  keyIdOf,
} from "@/lib/field-encryption";

const newKey = () => randomBytes(32).toString("base64");
const ENV = { ...process.env };

beforeEach(() => {
  process.env.FIELD_ENCRYPTION_KEY = newKey();
  delete process.env.FIELD_ENCRYPTION_KEY_PREVIOUS;
});
afterEach(() => {
  process.env = { ...ENV };
  vi.unstubAllEnvs();
});

describe("encryptValue / decryptValue", () => {
  it("round-trips and hides the plain text", () => {
    const c = encryptValue("+91 98765 43210", "User.phone");
    expect(isEncrypted(c)).toBe(true);
    expect(c).not.toContain("98765");
    expect(decryptValue(c)).toBe("+91 98765 43210");
  });

  it("uses a fresh IV each time, so equal values look different", () => {
    expect(encryptValue("same", "User.phone")).not.toBe(encryptValue("same", "User.phone"));
  });

  it("handles unicode", () => {
    expect(decryptValue(encryptValue("बिजली@upi", "Society.upiId"))).toBe("बिजली@upi");
  });

  it("never double-encrypts", () => {
    const c = encryptValue("x", "User.phone");
    expect(encryptValue(c, "User.phone")).toBe(c);
  });

  it("passes plain (legacy) values through when reading", () => {
    expect(decryptValue("+919876543210")).toBe("+919876543210");
  });

  it("detects tampering", () => {
    const c = encryptValue("secret@upi", "Society.upiId");
    const parts = c.split(":");
    const raw = Buffer.from(parts[4], "base64");
    raw[raw.length - 1] ^= 1;
    parts[4] = raw.toString("base64");
    expect(() => decryptValue(parts.join(":"))).toThrow(FieldEncryptionError);
  });

  it("refuses a ciphertext moved to another column", () => {
    const c = encryptValue("secret@upi", "Society.upiId");
    const moved = c.replace(":Society.upiId:", ":User.phone:");
    expect(() => decryptValue(moved)).toThrow(FieldEncryptionError);
  });

  it("refuses the wrong key with a helpful message", () => {
    const c = encryptValue("x", "User.phone");
    process.env.FIELD_ENCRYPTION_KEY = newKey();
    expect(() => decryptValue(c)).toThrow(/No encryption key matches/);
  });

  it("rejects a key of the wrong length", () => {
    process.env.FIELD_ENCRYPTION_KEY = Buffer.from("too short").toString("base64");
    expect(() => encryptValue("x", "User.phone")).toThrow(/32 bytes/);
  });
});

describe("key rotation", () => {
  it("reads values written with the previous key and writes with the new one", () => {
    const oldKey = process.env.FIELD_ENCRYPTION_KEY!;
    const oldCipher = encryptValue("+919876543210", "User.phone");
    const oldId = keyIdOf(oldCipher);

    process.env.FIELD_ENCRYPTION_KEY = newKey();
    process.env.FIELD_ENCRYPTION_KEY_PREVIOUS = oldKey;
    expect(decryptValue(oldCipher)).toBe("+919876543210");
    const fresh = encryptValue("+919876543210", "User.phone");
    expect(keyIdOf(fresh)).toBe(currentKeyId());
    expect(keyIdOf(fresh)).not.toBe(oldId);
  });
});

describe("without a key", () => {
  beforeEach(() => {
    delete process.env.FIELD_ENCRYPTION_KEY;
  });

  it("stores plain text in development and test", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(encryptValue("+91", "User.phone")).toBe("+91");
  });

  it("fails closed in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => encryptValue("+91", "User.phone")).toThrow(/FIELD_ENCRYPTION_KEY is not set/);
  });

  it("cannot read encrypted data", () => {
    process.env.FIELD_ENCRYPTION_KEY = newKey();
    const c = encryptValue("+91", "User.phone");
    delete process.env.FIELD_ENCRYPTION_KEY;
    expect(() => decryptValue(c)).toThrow(FieldEncryptionError);
  });
});

describe("decryptDeep", () => {
  it("decrypts values anywhere in rows, arrays and nested relations, leaving other types alone", () => {
    const phone = encryptValue("+919876543210", "User.phone");
    const date = new Date("2026-01-01");
    const out = decryptDeep([
      { id: "1", phone, createdAt: date, user: { name: "A", phone }, list: [{ phone }] },
      null,
      "plain",
    ]);
    expect(out[0]).toMatchObject({ phone: "+919876543210", user: { phone: "+919876543210" }, list: [{ phone: "+919876543210" }] });
    expect((out[0] as { createdAt: Date }).createdAt).toBe(date);
    expect(out[1]).toBeNull();
  });
});

describe("encryptWriteArgs", () => {
  it("encrypts configured fields of create, update and upsert", () => {
    const create = { data: { name: "A", phone: "+91111", email: "a@x.com" } };
    encryptWriteArgs("User", "create", create);
    expect(isEncrypted(create.data.phone)).toBe(true);
    expect(create.data.email).toBe("a@x.com");
    expect(create.data.name).toBe("A");

    const update = { where: { id: "1" }, data: { phone: "+91222" } };
    encryptWriteArgs("User", "update", update);
    expect(isEncrypted(update.data.phone)).toBe(true);

    const upsert = { where: {}, create: { upiId: "a@upi" }, update: { upiId: { set: "b@upi" } } };
    encryptWriteArgs("Society", "upsert", upsert);
    expect(isEncrypted(upsert.create.upiId)).toBe(true);
    expect(isEncrypted(upsert.update.upiId.set)).toBe(true);
  });

  it("encrypts every row of createMany and both UPI ids of a change request", () => {
    const many = { data: [{ phone: "+91111" }, { phone: "+91222" }] };
    encryptWriteArgs("User", "createMany", many);
    expect(many.data.every((d) => isEncrypted(d.phone))).toBe(true);

    const req = { data: { oldUpiId: "a@upi", newUpiId: "b@upi", note: "x" } };
    encryptWriteArgs("UpiChangeRequest", "create", req);
    expect(isEncrypted(req.data.oldUpiId) && isEncrypted(req.data.newUpiId)).toBe(true);
    expect(req.data.note).toBe("x");
  });

  it("reaches nested writes such as a society created together with its admin", () => {
    const args = { data: { name: "S", upiId: "s@upi", users: { create: { name: "A", phone: "+91333" } } } };
    encryptWriteArgs("Society", "create", args);
    expect(isEncrypted(args.data.upiId)).toBe(true);
    expect(isEncrypted(args.data.users.create.phone)).toBe(true);
  });

  it("leaves null, empty and unrelated models alone", () => {
    const a = { data: { phone: null, upiId: "" } };
    encryptWriteArgs("User", "update", a);
    expect(a.data).toEqual({ phone: null, upiId: "" });
    const b = { data: { title: "x", phone: "not-a-user-field" } };
    encryptWriteArgs("Notice", "create", b);
    expect(b.data.phone).toBe("not-a-user-field");
  });

  it("encrypts bound to the right column", () => {
    const a = { data: { phone: "+91444" } };
    encryptWriteArgs("User", "create", a);
    expect(a.data.phone).toContain(":User.phone:");
  });
});
