import { describe, it, expect } from "vitest";
import { normalizeTags, sniffMime, safeFileName, retainUntil, defaultVisibility, expiryState, formatBytes } from "@/lib/utils/documents";

const bytes = (...b: number[]) => Uint8Array.from([...b, ...Array(16 - b.length).fill(0)]);

describe("sniffMime", () => {
  it("recognises allowed files by content", () => {
    expect(sniffMime(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe("application/pdf");
    expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffMime(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0, 0, 0, 0]))).toBe("image/webp");
  });
  it("rejects scripts, executables and zips whatever they are named", () => {
    expect(sniffMime(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
    expect(sniffMime(bytes(0x4d, 0x5a))).toBeNull(); // Windows exe
    expect(sniffMime(bytes(0x50, 0x4b, 0x03, 0x04))).toBeNull(); // zip / docx
    expect(sniffMime(new Uint8Array())).toBeNull();
  });
  it("does not take a WAV (RIFF) for a WebP", () => {
    expect(sniffMime(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45, 0, 0, 0, 0]))).toBeNull();
  });
});

describe("safeFileName", () => {
  it("drops paths and control characters", () => {
    expect(safeFileName("..\\..\\evil/bill.pdf")).toBe("bill.pdf");
    expect(safeFileName('a"b<c>.pdf')).toBe("abc.pdf");
    expect(safeFileName("x\u0000y.png")).toBe("xy.png");
  });
  it("falls back and truncates while keeping the extension", () => {
    expect(safeFileName("///")).toBe("document");
    const long = safeFileName("a".repeat(300) + ".pdf");
    expect(long.length).toBe(120);
    expect(long.endsWith(".pdf")).toBe(true);
  });
});

describe("retention and visibility", () => {
  it("keeps tax and audit records for 8 years, nothing else", () => {
    const from = new Date("2026-10-23T00:00:00Z");
    expect(retainUntil("TAX_RECEIPT", from)?.getFullYear()).toBe(2034);
    expect(retainUntil("AUDIT", from)?.getFullYear()).toBe(2034);
    expect(retainUntil("BILL", from)).toBeNull();
  });
  it("defaults minutes, bylaws and notices to residents, everything else to committee", () => {
    expect(defaultVisibility("MINUTES")).toBe("RESIDENTS");
    expect(defaultVisibility("BYLAWS")).toBe("RESIDENTS");
    expect(defaultVisibility("NOTICE")).toBe("RESIDENTS");
    expect(defaultVisibility("BILL")).toBe("COMMITTEE");
    expect(defaultVisibility("AGREEMENT")).toBe("COMMITTEE");
  });
});

describe("expiryState / formatBytes", () => {
  const now = new Date("2026-10-23T00:00:00Z");
  it("flags expired and soon", () => {
    expect(expiryState(null, now)).toBeNull();
    expect(expiryState(new Date("2026-10-01"), now)).toBe("expired");
    expect(expiryState(new Date("2026-11-20"), now)).toBe("soon");
    expect(expiryState(new Date("2027-06-01"), now)).toBeNull();
  });
  it("formats sizes", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("normalizeTags", () => {
  it("lowercases, trims, collapses spaces and removes duplicates", () => {
    expect(normalizeTags(["  Lift ", "LIFT", "Vendor   Name", "2026"])).toEqual(["lift", "vendor name", "2026"]);
  });
  it("strips symbols that could break markup or searches", () => {
    expect(normalizeTags(["<b>bold</b>", "a;b|c", "R&D", "x-ray"])).toEqual(["bbold/b".replace("/", ""), "abc", "r&d", "x-ray"]);
  });
  it("drops empty and non-string items and ignores non-arrays", () => {
    expect(normalizeTags(["", "   ", 5, null, "ok"])).toEqual(["ok"]);
    expect(normalizeTags("lift")).toEqual([]);
    expect(normalizeTags(undefined)).toEqual([]);
  });
  it("caps the count at 10 and the length at 30", () => {
    expect(normalizeTags(Array.from({ length: 15 }, (_, i) => `t${i}`))).toHaveLength(10);
    expect(normalizeTags(["x".repeat(80)])[0]).toHaveLength(30);
  });
  it("keeps non-English letters", () => {
    expect(normalizeTags(["बिजली", "Café"])).toEqual(["बिजली", "café"]);
  });
});
