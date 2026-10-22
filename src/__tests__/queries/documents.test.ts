import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { document: { findFirst: vi.fn(), findMany: vi.fn() } },
}));
vi.mock("@/lib/storage", () => ({ deleteObject: vi.fn(), storageConfigured: vi.fn().mockReturnValue(true) }));

import { visibleTo, getDocumentForViewer, listDocuments, getTagCounts } from "@/lib/queries/documents";
import { prisma } from "@/lib/prisma";

describe("document visibility", () => {
  beforeEach(() => vi.clearAllMocks());

  it("committee roles see everything, residents only shared files", () => {
    for (const r of ["ADMIN", "SECRETARY", "TREASURER"] as const) expect(visibleTo(r)).toEqual({});
    for (const r of ["OWNER", "TENANT"] as const) expect(visibleTo(r)).toEqual({ visibility: "RESIDENTS" });
  });

  it("scopes a download lookup by society, status and visibility", async () => {
    await getDocumentForViewer("s1", "TENANT", "d1");
    expect(prisma.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d1", societyId: "s1", status: "READY", visibility: "RESIDENTS" } })
    );
  });

  it("lists only ready documents of the society", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([]);
    await listDocuments("s1", "OWNER", { category: "BILL" });
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { societyId: "s1", status: "READY", visibility: "RESIDENTS", category: "BILL" } })
    );
  });
});

describe("document tags", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts tags among visible documents only, most used first", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([{ tags: ["lift", "2026"] }, { tags: ["lift"] }, { tags: [] }] as never);
    expect(await getTagCounts("s1", "TENANT")).toEqual([{ tag: "lift", count: 2 }, { tag: "2026", count: 1 }]);
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { societyId: "s1", status: "READY", visibility: "RESIDENTS" } })
    );
  });

  it("filters by an exact tag", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([]);
    await listDocuments("s1", "ADMIN", { tag: "lift" });
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { societyId: "s1", status: "READY", tags: { has: "lift" } } })
    );
  });

  it("searches title, file name and every tag containing the text, within what the role can see", async () => {
    vi.mocked(prisma.document.findMany)
      .mockResolvedValueOnce([{ tags: ["lift amc", "lifeguard", "water"] }] as never) // tag counts lookup
      .mockResolvedValueOnce([] as never);
    await listDocuments("s1", "OWNER", { q: "  LIF " });
    const where = vi.mocked(prisma.document.findMany).mock.calls[1][0]!.where as Record<string, unknown>;
    expect(where).toMatchObject({ societyId: "s1", status: "READY", visibility: "RESIDENTS" });
    expect(where.OR).toEqual([
      { title: { contains: "lif", mode: "insensitive" } },
      { fileName: { contains: "lif", mode: "insensitive" } },
      { tags: { hasSome: ["lifeguard", "lift amc"] } },
    ]);
  });
});
