import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { document: { findFirst: vi.fn(), findMany: vi.fn() } },
}));
vi.mock("@/lib/storage", () => ({ deleteObject: vi.fn(), storageConfigured: vi.fn().mockReturnValue(true) }));

import { visibleTo, getDocumentForViewer, listDocuments, getTagCounts } from "@/lib/queries/documents";
import { prisma } from "@/lib/prisma";

describe("document visibility", () => {
  beforeEach(() => vi.clearAllMocks());

  it("committee roles see everything; residents see shared files and their own uploads", () => {
    for (const r of ["ADMIN", "SECRETARY", "TREASURER"] as const) expect(visibleTo(r, "u1")).toEqual({});
    for (const r of ["OWNER", "TENANT"] as const) {
      expect(visibleTo(r, "u1")).toEqual({ OR: [{ visibility: "RESIDENTS" }, { uploadedById: "u1" }] });
    }
  });

  it("scopes a download lookup by society, status and visibility", async () => {
    await getDocumentForViewer("s1", "TENANT", "u1", "d1");
    expect(prisma.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "d1", societyId: "s1", status: "READY", OR: [{ visibility: "RESIDENTS" }, { uploadedById: "u1" }] },
      })
    );
  });

  it("lists only ready documents of the society", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([]);
    await listDocuments("s1", "OWNER", "u1", { category: "BILL" });
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          societyId: "s1", status: "READY", category: "BILL",
          AND: [{ OR: [{ visibility: "RESIDENTS" }, { uploadedById: "u1" }] }, {}],
        },
      })
    );
  });

  it("keeps payment proofs out of the library unless asked by category", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([]);
    await listDocuments("s1", "ADMIN", "u1");
    expect(vi.mocked(prisma.document.findMany).mock.calls[0][0]!.where).toMatchObject({ category: { notIn: ["PAYMENT_PROOF", "COMPLAINT_PHOTO"] } });
  });
});

describe("document tags", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts tags among visible documents only, most used first", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([{ tags: ["lift", "2026"] }, { tags: ["lift"] }, { tags: [] }] as never);
    expect(await getTagCounts("s1", "TENANT", "u1")).toEqual([{ tag: "lift", count: 2 }, { tag: "2026", count: 1 }]);
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          societyId: "s1", status: "READY", category: { notIn: ["PAYMENT_PROOF", "COMPLAINT_PHOTO"] },
          OR: [{ visibility: "RESIDENTS" }, { uploadedById: "u1" }],
        },
      })
    );
  });

  it("filters by an exact tag", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([]);
    await listDocuments("s1", "ADMIN", "u1", { tag: "lift" });
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "s1", status: "READY", category: { notIn: ["PAYMENT_PROOF", "COMPLAINT_PHOTO"] }, tags: { has: "lift" }, AND: [{}, {}] },
      })
    );
  });

  it("searches title, file name and every tag containing the text, within what the role can see", async () => {
    vi.mocked(prisma.document.findMany)
      .mockResolvedValueOnce([{ tags: ["lift amc", "lifeguard", "water"] }] as never) // tag counts lookup
      .mockResolvedValueOnce([] as never);
    await listDocuments("s1", "OWNER", "u1", { q: "  LIF " });
    const where = vi.mocked(prisma.document.findMany).mock.calls[1][0]!.where as Record<string, unknown>;
    expect(where).toMatchObject({ societyId: "s1", status: "READY" });
    const [who, text] = where.AND as [object, { OR: unknown[] }];
    expect(who).toEqual({ OR: [{ visibility: "RESIDENTS" }, { uploadedById: "u1" }] });
    expect(text.OR).toEqual([
      { title: { contains: "lif", mode: "insensitive" } },
      { fileName: { contains: "lif", mode: "insensitive" } },
      { tags: { hasSome: ["lifeguard", "lift amc"] } },
    ]);
  });
});
