import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { document: { findFirst: vi.fn(), findMany: vi.fn() } },
}));
vi.mock("@/lib/storage", () => ({ deleteObject: vi.fn(), storageConfigured: vi.fn().mockReturnValue(true) }));

import { visibleTo, getDocumentForViewer, listDocuments } from "@/lib/queries/documents";
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
    await listDocuments("s1", "OWNER", "BILL");
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { societyId: "s1", status: "READY", visibility: "RESIDENTS", category: "BILL" } })
    );
  });
});
