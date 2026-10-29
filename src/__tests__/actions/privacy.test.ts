import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: vi.fn((a) => ({ op: "user.update", a })), findFirst: vi.fn() },
    consentRecord: { create: vi.fn((a) => ({ op: "consent.create", a })) },
    dataRequest: {
      count: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn((a) => ({ op: "dr.updateMany", a })),
    },
    creditEntry: { aggregate: vi.fn() },
    paymentClaim: { count: vi.fn() },
    expenseContribution: { count: vi.fn() },
    postComment: { deleteMany: vi.fn((a) => ({ op: "comments.delete", a })) },
    post: { deleteMany: vi.fn((a) => ({ op: "posts.delete", a })) },
    otpCode: { deleteMany: vi.fn((a) => ({ op: "otp.delete", a })) },
    account: { deleteMany: vi.fn((a) => ({ op: "account.delete", a })) },
    notificationLog: { updateMany: vi.fn((a) => ({ op: "log.update", a })) },
    $transaction: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("@/lib/session", () => ({
  getSession: vi.fn().mockResolvedValue({ user: { id: "u1", role: "OWNER", societyId: "s1" } }),
  requireRole: vi.fn().mockResolvedValue({ user: { id: "u1", role: "OWNER", societyId: "s1" } }),
}));

import { acceptPrivacy, requestDataChange, resolveDataRequest, anonymiseUser } from "@/actions/privacy";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PRIVACY_VERSION } from "@/lib/privacy";

const fd = (f: Record<string, string>) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  return d;
};
const asRole = (role: string, id = "u1") => vi.mocked(requireRole).mockResolvedValue({ user: { id, role, societyId: "s1" } } as never);

describe("acceptPrivacy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires the box to be ticked", async () => {
    expect(await acceptPrivacy(fd({}))).toHaveProperty("error");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("records the agreement on the profile and in the consent log, for the session's user", async () => {
    expect(await acceptPrivacy(fd({ agree: "on", userId: "someone-else" }))).toEqual({ success: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { privacyAcceptedAt: expect.any(Date), privacyVersion: PRIVACY_VERSION },
    });
    expect(prisma.consentRecord.create).toHaveBeenCalledWith({ data: { userId: "u1", societyId: "s1", version: PRIVACY_VERSION } });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("requestDataChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asRole("OWNER");
    vi.mocked(prisma.dataRequest.count).mockResolvedValue(0);
    vi.mocked(prisma.dataRequest.findFirst).mockResolvedValue(null);
  });

  it("is open to every society role and files the request for the session's user", async () => {
    expect(await requestDataChange(fd({ type: "ERASURE", note: "I moved out", userId: "x" }))).toEqual({ success: true });
    expect(requireRole).toHaveBeenCalledWith(["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"]);
    expect(prisma.dataRequest.create).toHaveBeenCalledWith({ data: { societyId: "s1", userId: "u1", type: "ERASURE", note: "I moved out" } });
  });

  it("needs details for a correction", async () => {
    expect(await requestDataChange(fd({ type: "CORRECTION" }))).toHaveProperty("error");
    expect(prisma.dataRequest.create).not.toHaveBeenCalled();
  });

  it("limits open requests and refuses duplicates", async () => {
    vi.mocked(prisma.dataRequest.count).mockResolvedValue(3);
    expect(await requestDataChange(fd({ type: "ERASURE" }))).toHaveProperty("error");
    vi.mocked(prisma.dataRequest.count).mockResolvedValue(1);
    vi.mocked(prisma.dataRequest.findFirst).mockResolvedValue({ id: "d" } as never);
    expect(await requestDataChange(fd({ type: "ERASURE" }))).toEqual({ error: "You already have an open request of this kind" });
  });

  it("rejects an unknown type", async () => {
    expect(await requestDataChange(fd({ type: "SELL_MY_DATA" }))).toHaveProperty("error");
  });
});

describe("resolveDataRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asRole("ADMIN", "adm");
    vi.mocked(prisma.dataRequest.findFirst).mockResolvedValue({ id: "r1", userId: "u9" } as never);
    vi.mocked(prisma.dataRequest.updateMany).mockResolvedValue({ count: 1 } as never);
  });

  it("is admin-only and scoped to the society and to open requests", async () => {
    expect(await resolveDataRequest("r1", "DONE", "Fixed")).toEqual({ success: true });
    expect(requireRole).toHaveBeenCalledWith(["ADMIN"]);
    expect(prisma.dataRequest.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "r1", societyId: "s1", status: "OPEN" } }));
    expect(prisma.dataRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "r1", societyId: "s1", status: "OPEN" },
      data: expect.objectContaining({ status: "DONE", handledById: "adm", resolutionNote: "Fixed" }),
    });
  });

  it("requires a reason to decline", async () => {
    expect(await resolveDataRequest("r1", "REJECTED")).toHaveProperty("error");
    expect(await resolveDataRequest("r1", "REJECTED", "Required for audit")).toEqual({ success: true });
  });

  it("stops an admin handling their own request", async () => {
    vi.mocked(prisma.dataRequest.findFirst).mockResolvedValue({ id: "r1", userId: "adm" } as never);
    expect(await resolveDataRequest("r1", "DONE")).toEqual({ error: "Another admin must handle your own request" });
    expect(prisma.dataRequest.updateMany).not.toHaveBeenCalled();
  });

  it("reports a request that is gone or already handled", async () => {
    vi.mocked(prisma.dataRequest.findFirst).mockResolvedValue(null);
    expect(await resolveDataRequest("x", "DONE")).toHaveProperty("error");
  });
});

describe("anonymiseUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asRole("ADMIN", "adm");
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u9", role: "TENANT", email: "t@x.com" } as never);
    vi.mocked(prisma.creditEntry.aggregate).mockResolvedValue({ _sum: { amount: 0 } } as never);
    vi.mocked(prisma.paymentClaim.count).mockResolvedValue(0);
    vi.mocked(prisma.expenseContribution.count).mockResolvedValue(0);
  });

  it("is admin-only and only finds users of the admin's society", async () => {
    await anonymiseUser("u9");
    expect(requireRole).toHaveBeenCalledWith(["ADMIN"]);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({ where: { id: "u9", societyId: "s1" }, select: { id: true, role: true, email: true } });
  });

  it("removes the identity and sign-in, deletes their posts, and keeps financial records", async () => {
    expect(await anonymiseUser("u9")).toEqual({ success: true });
    const data = vi.mocked(prisma.user.update).mock.calls[0][0].data as Record<string, unknown>;
    expect(data).toMatchObject({ name: "Former resident", email: "removed-u9@removed.invalid", phone: null, avatarUrl: null, isActive: false, emailVerifiedAt: null, phoneVerifiedAt: null });
    expect(data.passwordHash).toMatch(/^\$2/); // a random bcrypt hash nobody knows
    expect(prisma.post.deleteMany).toHaveBeenCalledWith({ where: { authorId: "u9" } });
    expect(prisma.postComment.deleteMany).toHaveBeenCalledWith({ where: { authorId: "u9" } });
    expect(prisma.notificationLog.updateMany).toHaveBeenCalledWith({ where: { userId: "u9", societyId: "s1" }, data: { to: "[removed]" } });
    // all in one transaction, and nothing touches money records
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.creditEntry).not.toHaveProperty("deleteMany");
  });

  it("closes the person's open erasure request", async () => {
    await anonymiseUser("u9");
    expect(prisma.dataRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u9", societyId: "s1", type: "ERASURE", status: "OPEN" } })
    );
  });

  it.each([
    ["their own account", async () => anonymiseUser("adm")],
  ])("refuses %s", async (_n, run) => {
    expect(await run()).toHaveProperty("error");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses while the member holds credit or has reports awaiting review", async () => {
    vi.mocked(prisma.creditEntry.aggregate).mockResolvedValue({ _sum: { amount: 250.5 } } as never);
    expect(await anonymiseUser("u9")).toHaveProperty("error");
    vi.mocked(prisma.creditEntry.aggregate).mockResolvedValue({ _sum: { amount: 0 } } as never);
    vi.mocked(prisma.paymentClaim.count).mockResolvedValue(1);
    expect(await anonymiseUser("u9")).toHaveProperty("error");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses an unknown user, another society's user, or one already erased", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    expect(await anonymiseUser("nope")).toEqual({ error: "User not found" });
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u9", role: "TENANT", email: "removed-u9@removed.invalid" } as never);
    expect(await anonymiseUser("u9")).toEqual({ error: "This account was already erased" });
  });
});
