import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    society: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    user: { count: vi.fn() },
    upiChangeRequest: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/notify/upi", () => ({ notifyUpiChange: vi.fn() }));

import { requestUpiChange, approveUpiChange, rejectUpiChange, cancelUpiChange } from "@/actions/upi";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { notifyUpiChange } from "@/lib/notify/upi";
import { UPI_REQUEST_TTL_MS } from "@/lib/queries/upi";

const society = vi.mocked(prisma.society);
const reqs = vi.mocked(prisma.upiChangeRequest);
const fd = (f: Record<string, string>) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  return d;
};

const admin = { user: { id: "a1", name: "Asha", role: "ADMIN", societyId: "s1" } };
const treasurer = { user: { id: "t1", name: "Tara", role: "TREASURER", societyId: "s1" } };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRole).mockResolvedValue(admin as never);
});

describe("requestUpiChange", () => {
  beforeEach(() => {
    society.findUnique.mockResolvedValue({ upiId: "old@bank" } as never);
    reqs.findFirst.mockResolvedValue(null);
    vi.mocked(prisma.user.count).mockResolvedValue(1);
  });

  it("is ADMIN only", async () => {
    await requestUpiChange(fd({ upiId: "new@bank" }));
    expect(requireRole).toHaveBeenCalledWith(["ADMIN"]);
  });

  it("creates a pending request and leaves the live UPI ID alone", async () => {
    const r = await requestUpiChange(fd({ upiId: " New@Bank " }));
    expect(r).toEqual({ success: true, applied: false });
    expect(reqs.create).toHaveBeenCalledWith({
      data: { societyId: "s1", oldUpiId: "old@bank", newUpiId: "new@bank", requestedById: "a1" },
    });
    expect(society.update).not.toHaveBeenCalled();
    expect(society.updateMany).not.toHaveBeenCalled();
    expect(notifyUpiChange).toHaveBeenCalledWith(expect.objectContaining({ kind: "requested", societyId: "s1", requestedById: "a1" }));
  });

  it("rejects invalid or unchanged IDs", async () => {
    expect(await requestUpiChange(fd({ upiId: "not valid" }))).toMatchObject({ error: expect.stringMatching(/valid UPI/) });
    expect(await requestUpiChange(fd({ upiId: "OLD@bank" }))).toMatchObject({ error: expect.stringMatching(/already the current/) });
    expect(reqs.create).not.toHaveBeenCalled();
  });

  it("blocks a second request while one is pending, but not after it lapsed", async () => {
    reqs.findFirst.mockResolvedValue({ createdAt: new Date() } as never);
    expect(await requestUpiChange(fd({ upiId: "new@bank" }))).toMatchObject({ error: expect.stringMatching(/already awaiting/) });

    reqs.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - UPI_REQUEST_TTL_MS - 1000) } as never);
    expect(await requestUpiChange(fd({ upiId: "new@bank" }))).toMatchObject({ success: true });
  });

  it("refuses when nobody else could approve", async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(0);
    expect(await requestUpiChange(fd({ upiId: "new@bank" }))).toMatchObject({ error: expect.stringMatching(/approve/) });
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { societyId: "s1", isActive: true, role: { in: ["ADMIN", "TREASURER"] }, id: { not: "a1" } },
    });
    expect(reqs.create).not.toHaveBeenCalled();
  });

  it("applies the very first UPI ID straight away and logs it", async () => {
    society.findUnique.mockResolvedValue({ upiId: null } as never);
    const r = await requestUpiChange(fd({ upiId: "first@bank" }));
    expect(r).toEqual({ success: true, applied: true });
    expect(reqs.create.mock.calls[0][0].data).toMatchObject({ status: "APPROVED", oldUpiId: null, newUpiId: "first@bank", reviewNote: "Initial set-up" });
    expect(society.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { upiId: "first@bank", upiChangedAt: expect.any(Date) } });
  });
});

describe("approveUpiChange", () => {
  const pending = (over: Record<string, unknown> = {}) => ({
    id: "r1", requestedById: "a1", oldUpiId: "old@bank", newUpiId: "new@bank",
    createdAt: new Date(), requestedBy: { name: "Asha" }, ...over,
  });
  beforeEach(() => {
    vi.mocked(requireRole).mockResolvedValue(treasurer as never);
    reqs.findFirst.mockResolvedValue(pending() as never);
    reqs.updateMany.mockResolvedValue({ count: 1 } as never);
  });

  it("is ADMIN/TREASURER only and looks up the request inside the society", async () => {
    await approveUpiChange("r1");
    expect(requireRole).toHaveBeenCalledWith(["ADMIN", "TREASURER"]);
    expect(reqs.findFirst.mock.calls[0][0]!.where).toEqual({ id: "r1", societyId: "s1", status: "PENDING" });
  });

  it("applies the change for a different approver and emails everyone", async () => {
    const r = await approveUpiChange("r1");
    expect(r).toEqual({ success: true });
    expect(reqs.updateMany).toHaveBeenCalledWith({
      where: { id: "r1", societyId: "s1", status: "PENDING" },
      data: { status: "APPROVED", reviewedById: "t1", reviewedAt: expect.any(Date) },
    });
    expect(society.updateMany).toHaveBeenCalledWith({ where: { id: "s1" }, data: { upiId: "new@bank", upiChangedAt: expect.any(Date) } });
    expect(notifyUpiChange).toHaveBeenCalledWith(expect.objectContaining({ kind: "approved", reviewedByName: "Tara" }));
  });

  it("never lets the requester approve their own request", async () => {
    vi.mocked(requireRole).mockResolvedValue(admin as never);
    expect(await approveUpiChange("r1")).toMatchObject({ error: expect.stringMatching(/own request/) });
    expect(society.updateMany).not.toHaveBeenCalled();
    expect(reqs.updateMany).not.toHaveBeenCalled();
  });

  it("lets a second admin approve", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { id: "a2", name: "Amit", role: "ADMIN", societyId: "s1" } } as never);
    expect(await approveUpiChange("r1")).toMatchObject({ success: true });
  });

  it("refuses expired, missing and already-handled requests without touching the UPI ID", async () => {
    reqs.findFirst.mockResolvedValue(pending({ createdAt: new Date(Date.now() - UPI_REQUEST_TTL_MS - 1000) }) as never);
    expect(await approveUpiChange("r1")).toMatchObject({ error: expect.stringMatching(/expired/) });

    reqs.findFirst.mockResolvedValue(null);
    expect(await approveUpiChange("other-society-request")).toMatchObject({ error: expect.any(String) });

    reqs.findFirst.mockResolvedValue(pending() as never);
    reqs.updateMany.mockResolvedValue({ count: 0 } as never); // someone else decided first
    expect(await approveUpiChange("r1")).toMatchObject({ error: expect.any(String) });
    expect(society.updateMany).not.toHaveBeenCalled();
  });

  it("cancels other pending requests once one is approved", async () => {
    await approveUpiChange("r1");
    expect(reqs.updateMany).toHaveBeenCalledWith({
      where: { societyId: "s1", status: "PENDING", id: { not: "r1" } },
      data: { status: "CANCELLED", reviewNote: expect.any(String) },
    });
  });
});

describe("rejectUpiChange", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockResolvedValue(treasurer as never);
    reqs.findFirst.mockResolvedValue({ id: "r1", requestedById: "a1", oldUpiId: "old@bank", newUpiId: "new@bank", requestedBy: { name: "Asha" } } as never);
    reqs.updateMany.mockResolvedValue({ count: 1 } as never);
  });

  it("rejects with a reason and keeps the UPI ID", async () => {
    expect(await rejectUpiChange(fd({ requestId: "r1", reason: "Not confirmed" }))).toEqual({ success: true });
    expect(reqs.updateMany).toHaveBeenCalledWith({
      where: { id: "r1", societyId: "s1", status: "PENDING" },
      data: expect.objectContaining({ status: "REJECTED", reviewNote: "Not confirmed", reviewedById: "t1" }),
    });
    expect(society.updateMany).not.toHaveBeenCalled();
    expect(notifyUpiChange).toHaveBeenCalledWith(expect.objectContaining({ kind: "rejected" }));
  });

  it("tells the requester to cancel instead", async () => {
    vi.mocked(requireRole).mockResolvedValue(admin as never);
    expect(await rejectUpiChange(fd({ requestId: "r1" }))).toMatchObject({ error: expect.stringMatching(/Cancel/) });
  });
});

describe("cancelUpiChange", () => {
  it("only withdraws the caller's own pending request in their society", async () => {
    reqs.updateMany.mockResolvedValue({ count: 1 } as never);
    expect(await cancelUpiChange("r1")).toEqual({ success: true });
    expect(requireRole).toHaveBeenCalledWith(["ADMIN"]);
    expect(reqs.updateMany.mock.calls[0][0]!.where).toEqual({ id: "r1", societyId: "s1", requestedById: "a1", status: "PENDING" });

    reqs.updateMany.mockResolvedValue({ count: 0 } as never);
    expect(await cancelUpiChange("someone-elses")).toMatchObject({ error: expect.any(String) });
  });
});
