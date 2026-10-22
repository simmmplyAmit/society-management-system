import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    expense: { findFirst: vi.fn() },
    income: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/session", () => ({
  requireRole: vi.fn().mockResolvedValue({ user: { id: "u1", role: "TREASURER", societyId: "s1" } }),
}));
vi.mock("@/lib/storage", () => {
  class StorageNotConfiguredError extends Error {}
  return {
    StorageNotConfiguredError,
    signUpload: vi.fn().mockResolvedValue("https://r2.example/put"),
    inspectObject: vi.fn(),
    deleteObject: vi.fn().mockResolvedValue(undefined),
  };
});
vi.mock("@/lib/queries/documents", () => ({
  getStorageUsed: vi.fn().mockResolvedValue(0),
  quotaBytes: vi.fn().mockReturnValue(1024 * 1024 * 1024),
}));

import { requestDocumentUpload, confirmDocumentUpload, deleteDocument, updateDocumentTags } from "@/actions/documents";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { signUpload, inspectObject, deleteObject, StorageNotConfiguredError } from "@/lib/storage";
import { getStorageUsed } from "@/lib/queries/documents";

const fd = (f: Record<string, string>) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  return d;
};
const valid = { title: "Lift AMC", category: "AGREEMENT", fileName: "amc.pdf", mimeType: "application/pdf", sizeBytes: "2048" };
const pdfHead = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

describe("requestDocumentUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStorageUsed).mockResolvedValue(0);
    vi.mocked(signUpload).mockResolvedValue("https://r2.example/put");
  });

  it("is limited to the committee", async () => {
    await requestDocumentUpload(fd(valid));
    expect(requireRole).toHaveBeenCalledWith(["ADMIN", "SECRETARY", "TREASURER"]);
  });

  it("reserves a pending record under the session's society and returns a signed link", async () => {
    const r = await requestDocumentUpload(fd({ ...valid, societyId: "other" }));
    expect(r).toMatchObject({ success: true, uploadUrl: "https://r2.example/put", contentType: "application/pdf" });
    const data = vi.mocked(prisma.document.create).mock.calls[0][0].data;
    expect(data).toMatchObject({ societyId: "s1", status: "PENDING", uploadedById: "u1", visibility: "COMMITTEE", retainUntil: null });
    expect(data.storageKey).toMatch(/^societies\/s1\/[0-9a-f-]+\/[0-9a-f-]+\.pdf$/);
    expect(data.storageKey).not.toContain("amc");
    expect(signUpload).toHaveBeenCalledWith(data.storageKey, "application/pdf", 2048);
  });

  it("stores tidied tags", async () => {
    await requestDocumentUpload(fd({ ...valid, tags: JSON.stringify([" Lift ", "LIFT", "AMC 2026"]) }));
    expect(vi.mocked(prisma.document.create).mock.calls[0][0].data.tags).toEqual(["lift", "amc 2026"]);
  });

  it("rejects malformed tags without creating a record", async () => {
    expect(await requestDocumentUpload(fd({ ...valid, tags: "{not json" }))).toEqual({ error: "Invalid tags" });
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it("attaches to an expense of the same society", async () => {
    vi.mocked(prisma.expense.findFirst).mockResolvedValue({ id: "e1" } as never);
    const r = await requestDocumentUpload(fd({ ...valid, category: "BILL", expenseId: "e1" }));
    expect(r).toMatchObject({ success: true });
    expect(prisma.expense.findFirst).toHaveBeenCalledWith({ where: { id: "e1", societyId: "s1" }, select: { id: true } });
    expect(vi.mocked(prisma.document.create).mock.calls[0][0].data).toMatchObject({ expenseId: "e1", incomeId: null });
  });

  it("attaches to an income entry of the same society", async () => {
    vi.mocked(prisma.income.findFirst).mockResolvedValue({ id: "i1" } as never);
    await requestDocumentUpload(fd({ ...valid, incomeId: "i1" }));
    expect(prisma.income.findFirst).toHaveBeenCalledWith({ where: { id: "i1", societyId: "s1" }, select: { id: true } });
    expect(vi.mocked(prisma.document.create).mock.calls[0][0].data).toMatchObject({ incomeId: "i1", expenseId: null });
  });

  it("refuses an expense or income entry from another society", async () => {
    vi.mocked(prisma.expense.findFirst).mockResolvedValue(null);
    expect(await requestDocumentUpload(fd({ ...valid, expenseId: "foreign" }))).toEqual({ error: "That entry was not found" });
    expect(prisma.document.create).not.toHaveBeenCalled();
    expect(signUpload).not.toHaveBeenCalled();
  });

  it("refuses to attach to both an expense and an income entry", async () => {
    expect(await requestDocumentUpload(fd({ ...valid, expenseId: "e1", incomeId: "i1" }))).toHaveProperty("error");
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it("only lets an admin or the treasurer attach to entries", async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ user: { id: "sec", role: "SECRETARY", societyId: "s1" } } as never);
    expect(await requestDocumentUpload(fd({ ...valid, expenseId: "e1" }))).toHaveProperty("error");
    expect(prisma.expense.findFirst).not.toHaveBeenCalled();
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it("sets an 8-year retention on tax receipts", async () => {
    await requestDocumentUpload(fd({ ...valid, category: "TAX_RECEIPT" }));
    expect(vi.mocked(prisma.document.create).mock.calls[0][0].data.retainUntil).toBeInstanceOf(Date);
  });

  it.each([
    ["an executable", { mimeType: "application/x-msdownload", fileName: "a.exe" }],
    ["a docx", { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }],
    ["a file over 10 MB", { sizeBytes: String(11 * 1024 * 1024) }],
    ["an empty file", { sizeBytes: "0" }],
    ["an unknown category", { category: "SECRETS" }],
    ["a short title", { title: "a" }],
    ["a bad expiry date", { expiresOn: "nope" }],
  ])("rejects %s", async (_n, patch) => {
    expect(await requestDocumentUpload(fd({ ...valid, ...patch }))).toHaveProperty("error");
    expect(prisma.document.create).not.toHaveBeenCalled();
    expect(signUpload).not.toHaveBeenCalled();
  });

  it("refuses when the society's storage would overflow", async () => {
    vi.mocked(getStorageUsed).mockResolvedValue(1024 * 1024 * 1024 - 100);
    expect(await requestDocumentUpload(fd(valid))).toHaveProperty("error");
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it("explains when storage isn't configured, without creating a record", async () => {
    vi.mocked(signUpload).mockRejectedValue(new StorageNotConfiguredError());
    const r = await requestDocumentUpload(fd(valid));
    expect(r).toHaveProperty("error");
    expect(prisma.document.create).not.toHaveBeenCalled();
  });
});

describe("confirmDocumentUpload", () => {
  const pending = { id: "d1", storageKey: "societies/s1/d1/x.pdf", mimeType: "application/pdf", sizeBytes: 2048 };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.document.findFirst).mockResolvedValue(pending as never);
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(inspectObject).mockResolvedValue({ size: 2048, head: pdfHead });
  });

  it("only finds the caller's own pending upload in their society", async () => {
    await confirmDocumentUpload("d1");
    expect(prisma.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d1", societyId: "s1", status: "PENDING", uploadedById: "u1" } })
    );
  });

  it("publishes a verified file with a guarded update", async () => {
    expect(await confirmDocumentUpload("d1")).toEqual({ success: true });
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: { id: "d1", societyId: "s1", status: "PENDING" },
      data: expect.objectContaining({ status: "READY" }),
    });
  });

  it("rejects and removes a file whose contents aren't what it claimed", async () => {
    vi.mocked(inspectObject).mockResolvedValue({ size: 2048, head: new TextEncoder().encode("<html><script>") });
    expect(await confirmDocumentUpload("d1")).toHaveProperty("error");
    expect(deleteObject).toHaveBeenCalledWith(pending.storageKey);
    expect(prisma.document.deleteMany).toHaveBeenCalledWith({ where: { id: "d1", societyId: "s1", status: "PENDING" } });
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a size that differs from what was declared", async () => {
    vi.mocked(inspectObject).mockResolvedValue({ size: 9999, head: pdfHead });
    expect(await confirmDocumentUpload("d1")).toHaveProperty("error");
    expect(deleteObject).toHaveBeenCalled();
  });

  it("rejects when nothing was uploaded", async () => {
    vi.mocked(inspectObject).mockResolvedValue(null);
    expect(await confirmDocumentUpload("d1")).toHaveProperty("error");
  });

  it("returns an error for someone else's or an unknown upload", async () => {
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null);
    expect(await confirmDocumentUpload("nope")).toEqual({ error: "Upload not found" });
    expect(inspectObject).not.toHaveBeenCalled();
  });
});

describe("deleteDocument", () => {
  const doc = { id: "d1", uploadedById: "u1", retainUntil: null as Date | null };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.document.findFirst).mockResolvedValue(doc as never);
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(requireRole).mockResolvedValue({ user: { id: "u1", role: "TREASURER", societyId: "s1" } } as never);
  });

  it("soft-deletes within the society", async () => {
    expect(await deleteDocument("d1")).toMatchObject({ success: true });
    expect(prisma.document.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "d1", societyId: "s1", status: "READY" } }));
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: { id: "d1", societyId: "s1", status: "READY" },
      data: expect.objectContaining({ status: "DELETED", deletedById: "u1" }),
    });
  });

  it("blocks deleting a record inside its retention period", async () => {
    vi.mocked(prisma.document.findFirst).mockResolvedValue({ ...doc, retainUntil: new Date(Date.now() + 86_400_000) } as never);
    expect(await deleteDocument("d1")).toHaveProperty("error");
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
  });

  it("lets a secretary delete only what they uploaded", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { id: "sec", role: "SECRETARY", societyId: "s1" } } as never);
    expect(await deleteDocument("d1")).toHaveProperty("error");
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
    vi.mocked(prisma.document.findFirst).mockResolvedValue({ ...doc, uploadedById: "sec" } as never);
    expect(await deleteDocument("d1")).toMatchObject({ success: true });
  });

  it("doesn't find a document of another society", async () => {
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null);
    expect(await deleteDocument("x")).toEqual({ error: "Document not found" });
  });
});

describe("updateDocumentTags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });
  });

  it("is limited to the committee and scoped to the society", async () => {
    const r = await updateDocumentTags("d1", fd({ tags: JSON.stringify(["Lift", "2026"]) }));
    expect(requireRole).toHaveBeenCalledWith(["ADMIN", "SECRETARY", "TREASURER"]);
    expect(r).toEqual({ success: true, tags: ["lift", "2026"] });
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: { id: "d1", societyId: "s1", status: "READY" },
      data: { tags: ["lift", "2026"] },
    });
  });

  it("can clear all tags", async () => {
    await updateDocumentTags("d1", fd({ tags: "[]" }));
    expect(vi.mocked(prisma.document.updateMany).mock.calls[0][0].data).toEqual({ tags: [] });
  });

  it("reports a document that isn't in this society", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 0 });
    expect(await updateDocumentTags("x", fd({ tags: "[]" }))).toEqual({ error: "Document not found" });
  });

  it("rejects malformed tags", async () => {
    expect(await updateDocumentTags("d1", fd({ tags: "nope" }))).toEqual({ error: "Invalid tags" });
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
  });
});
