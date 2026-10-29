import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => {
  const m = () => ({ findMany: vi.fn().mockResolvedValue([]) });
  return {
    prisma: {
      user: { findUnique: vi.fn().mockResolvedValue({ name: "Asha" }) },
      flatResident: m(), creditEntry: m(), paymentClaim: m(), complaint: m(), post: m(),
      postComment: m(), document: m(), notificationLog: m(), consentRecord: m(), dataRequest: m(),
    },
  };
});

import { getMyData } from "@/lib/queries/my-data";
import { prisma } from "@/lib/prisma";

describe("getMyData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("only ever reads rows that belong to this person in this society", async () => {
    await getMyData("s1", "u1");
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "u1" } }));
    const where = (m: { findMany: unknown }) =>
      (vi.mocked(m.findMany as (...a: unknown[]) => unknown).mock.calls[0][0]) as { where: Record<string, unknown> };
    expect(where(prisma.flatResident).where).toMatchObject({ userId: "u1", flat: { societyId: "s1" } });
    expect(where(prisma.creditEntry).where).toEqual({ societyId: "s1", userId: "u1" });
    expect(where(prisma.paymentClaim).where).toEqual({ societyId: "s1", userId: "u1" });
    expect(where(prisma.complaint).where).toEqual({ societyId: "s1", raisedById: "u1" });
    expect(where(prisma.post).where).toEqual({ societyId: "s1", authorId: "u1" });
    expect(where(prisma.postComment).where).toEqual({ societyId: "s1", authorId: "u1" });
    expect(where(prisma.document).where).toMatchObject({ societyId: "s1", uploadedById: "u1" });
    expect(where(prisma.notificationLog).where).toEqual({ societyId: "s1", userId: "u1" });
    expect(where(prisma.consentRecord).where).toEqual({ userId: "u1" });
    expect(where(prisma.dataRequest).where).toEqual({ societyId: "s1", userId: "u1" });
  });

  it("leaves out committee-only complaint notes", async () => {
    await getMyData("s1", "u1");
    const args = vi.mocked(prisma.complaint.findMany).mock.calls[0][0] as { select: { updates: { where: unknown } } };
    expect(args.select.updates.where).toEqual({ internal: false });
  });
});
