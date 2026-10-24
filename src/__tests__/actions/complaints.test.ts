import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = { complaint: { updateMany: vi.fn() }, complaintUpdate: { create: vi.fn() } };
vi.mock("@/lib/prisma", () => ({
  prisma: {
    complaint: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    flatResident: { findFirst: vi.fn() },
    user: { findFirst: vi.fn() },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  },
}));
vi.mock("@/lib/session", () => ({
  requireRole: vi.fn().mockResolvedValue({ user: { id: "res1", name: "Asha", role: "OWNER", societyId: "s1" } }),
}));
vi.mock("@/lib/notify/community", () => ({ notifyComplaint: vi.fn().mockResolvedValue(undefined) }));

import { raiseComplaint, addComplaintUpdate, changeComplaintStatus, assignComplaint } from "@/actions/complaints";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { notifyComplaint } from "@/lib/notify/community";

const fd = (f: Record<string, string>) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  return d;
};
const asUser = (role: string, id: string, name = "Someone") =>
  vi.mocked(requireRole).mockResolvedValue({ user: { id, name, role, societyId: "s1" } } as never);
const complaint = (over: object = {}) => ({
  id: "c1", title: "Leak", status: "OPEN", raisedById: "res1", assignedToId: null, resolvedAt: null, closedAt: null, ...over,
});
const sent = (call: number) => (vi.mocked(prisma.complaint.update).mock.calls[call][0].data as unknown as { updates: { create: Record<string, unknown> } }).updates.create;
const valid = { category: "PLUMBING", title: "Leak in bathroom", description: "Water is dripping from the ceiling", priority: "URGENT" };

describe("raiseComplaint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asUser("OWNER", "res1", "Asha");
    vi.mocked(prisma.complaint.count).mockResolvedValue(0);
    vi.mocked(prisma.complaint.create).mockResolvedValue({ id: "c1" } as never);
  });

  it("is open to every society role and files it under the session's user and society", async () => {
    const r = await raiseComplaint(fd({ ...valid, societyId: "other", raisedById: "x" }));
    expect(r).toEqual({ success: true, complaintId: "c1" });
    expect(requireRole).toHaveBeenCalledWith(["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"]);
    expect(vi.mocked(prisma.complaint.create).mock.calls[0][0].data).toMatchObject({
      societyId: "s1", raisedById: "res1", category: "PLUMBING", priority: "URGENT", flatId: null,
    });
    expect(notifyComplaint).toHaveBeenCalledWith(expect.objectContaining({ kind: "raised", complaintId: "c1", actorId: "res1" }));
  });

  it("only accepts a flat the person is linked to", async () => {
    vi.mocked(prisma.flatResident.findFirst).mockResolvedValue(null);
    expect(await raiseComplaint(fd({ ...valid, flatId: "someone-elses" }))).toHaveProperty("error");
    expect(prisma.flatResident.findFirst).toHaveBeenCalledWith({
      where: { userId: "res1", flatId: "someone-elses", flat: { societyId: "s1" } }, select: { flatId: true },
    });
    expect(prisma.complaint.create).not.toHaveBeenCalled();

    vi.mocked(prisma.flatResident.findFirst).mockResolvedValue({ flatId: "f1" } as never);
    await raiseComplaint(fd({ ...valid, flatId: "f1" }));
    expect(vi.mocked(prisma.complaint.create).mock.calls[0][0].data).toMatchObject({ flatId: "f1" });
  });

  it("limits open complaints", async () => {
    vi.mocked(prisma.complaint.count).mockResolvedValue(15);
    expect(await raiseComplaint(fd(valid))).toHaveProperty("error");
    expect(prisma.complaint.create).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown type", { category: "WITCHCRAFT" }],
    ["short title", { title: "ab" }],
    ["short description", { description: "no" }],
    ["huge description", { description: "x".repeat(2001) }],
  ])("rejects %s", async (_n, patch) => {
    expect(await raiseComplaint(fd({ ...valid, ...patch }))).toHaveProperty("error");
    expect(prisma.complaint.create).not.toHaveBeenCalled();
  });
});

describe("privacy: who can reach a complaint", () => {
  beforeEach(() => vi.clearAllMocks());

  it("treats another resident's complaint as not found", async () => {
    asUser("TENANT", "other-resident");
    vi.mocked(prisma.complaint.findFirst).mockResolvedValue(complaint() as never);
    expect(await addComplaintUpdate("c1", fd({ body: "hello" }))).toEqual({ error: "Complaint not found" });
    expect(await changeComplaintStatus("c1", "CLOSED")).toEqual({ error: "Complaint not found" });
    expect(prisma.complaint.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("looks the complaint up inside the caller's society", async () => {
    asUser("ADMIN", "adm");
    vi.mocked(prisma.complaint.findFirst).mockResolvedValue(null);
    await addComplaintUpdate("c1", fd({ body: "hello" }));
    expect(vi.mocked(prisma.complaint.findFirst).mock.calls[0][0]!.where).toEqual({ id: "c1", societyId: "s1" });
  });
});

describe("addComplaintUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.complaint.findFirst).mockResolvedValue(complaint() as never);
  });

  it("lets the resident message the committee without notifying themselves", async () => {
    asUser("OWNER", "res1");
    expect(await addComplaintUpdate("c1", fd({ body: "Any update?" }))).toEqual({ success: true });
    expect(sent(0)).toMatchObject({ authorId: "res1", internal: false });
    expect(notifyComplaint).not.toHaveBeenCalled();
  });

  it("ignores the internal flag from a resident", async () => {
    asUser("OWNER", "res1");
    await addComplaintUpdate("c1", fd({ body: "x", internal: "on" }));
    expect(sent(0).internal).toBe(false);
  });

  it("emails the resident for a committee reply but never for an internal note", async () => {
    asUser("SECRETARY", "sec", "Secretary");
    await addComplaintUpdate("c1", fd({ body: "Plumber coming Monday" }));
    expect(notifyComplaint).toHaveBeenCalledWith(expect.objectContaining({ kind: "reply", raisedById: "res1" }));
    vi.mocked(notifyComplaint).mockClear();
    await addComplaintUpdate("c1", fd({ body: "Resident is difficult", internal: "on" }));
    expect(sent(1).internal).toBe(true);
    expect(notifyComplaint).not.toHaveBeenCalled();
  });

  it("refuses messages on a closed complaint", async () => {
    asUser("OWNER", "res1");
    vi.mocked(prisma.complaint.findFirst).mockResolvedValue(complaint({ status: "CLOSED" }) as never);
    expect(await addComplaintUpdate("c1", fd({ body: "hi" }))).toHaveProperty("error");
  });

  it("rejects empty and over-long messages", async () => {
    asUser("OWNER", "res1");
    expect(await addComplaintUpdate("c1", fd({ body: "  " }))).toHaveProperty("error");
    expect(await addComplaintUpdate("c1", fd({ body: "x".repeat(1001) }))).toHaveProperty("error");
  });
});

describe("changeComplaintStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.complaint.updateMany.mockResolvedValue({ count: 1 });
  });

  it("lets the committee start work, guarded on the current status and logged", async () => {
    asUser("SECRETARY", "sec", "Secretary");
    vi.mocked(prisma.complaint.findFirst).mockResolvedValue(complaint() as never);
    expect(await changeComplaintStatus("c1", "IN_PROGRESS")).toMatchObject({ success: true, status: "IN_PROGRESS" });
    expect(tx.complaint.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1", societyId: "s1", status: "OPEN" } }));
    expect(tx.complaintUpdate.create.mock.calls[0][0].data).toMatchObject({ kind: "STATUS", fromStatus: "OPEN", toStatus: "IN_PROGRESS", authorId: "sec" });
    expect(notifyComplaint).toHaveBeenCalledWith(expect.objectContaining({ kind: "status" }));
  });

  it("requires a resolution note", async () => {
    asUser("ADMIN", "adm");
    vi.mocked(prisma.complaint.findFirst).mockResolvedValue(complaint({ status: "IN_PROGRESS" }) as never);
    expect(await changeComplaintStatus("c1", "RESOLVED")).toEqual({ error: "Say what was done to resolve it" });
    expect(await changeComplaintStatus("c1", "RESOLVED", "Replaced the pipe")).toMatchObject({ success: true });
    expect(tx.complaint.updateMany.mock.calls[0][0].data).toMatchObject({ status: "RESOLVED", resolutionNote: "Replaced the pipe" });
  });

  it("does not let the committee close a complaint for the resident", async () => {
    asUser("ADMIN", "adm");
    vi.mocked(prisma.complaint.findFirst).mockResolvedValue(complaint({ status: "RESOLVED" }) as never);
    expect(await changeComplaintStatus("c1", "CLOSED")).toHaveProperty("error");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("lets the resident confirm a resolved complaint, without emailing themselves", async () => {
    asUser("OWNER", "res1");
    vi.mocked(prisma.complaint.findFirst).mockResolvedValue(complaint({ status: "RESOLVED", resolvedAt: new Date() }) as never);
    expect(await changeComplaintStatus("c1", "CLOSED")).toMatchObject({ success: true });
    expect(notifyComplaint).not.toHaveBeenCalled();
  });

  it("lets the resident reopen within 14 days but not after", async () => {
    asUser("OWNER", "res1");
    vi.mocked(prisma.complaint.findFirst).mockResolvedValue(complaint({ status: "CLOSED", closedAt: new Date(Date.now() - 3 * 86_400_000) }) as never);
    expect(await changeComplaintStatus("c1", "OPEN", "Came back")).toMatchObject({ success: true });
    vi.mocked(prisma.complaint.findFirst).mockResolvedValue(complaint({ status: "CLOSED", closedAt: new Date(Date.now() - 30 * 86_400_000) }) as never);
    expect(await changeComplaintStatus("c1", "OPEN")).toHaveProperty("error");
  });

  it("stops a resident resolving or progressing their own complaint", async () => {
    asUser("OWNER", "res1");
    vi.mocked(prisma.complaint.findFirst).mockResolvedValue(complaint() as never);
    expect(await changeComplaintStatus("c1", "RESOLVED", "I fixed it")).toHaveProperty("error");
    expect(await changeComplaintStatus("c1", "IN_PROGRESS")).toHaveProperty("error");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("reports a lost race instead of overwriting it", async () => {
    asUser("ADMIN", "adm");
    vi.mocked(prisma.complaint.findFirst).mockResolvedValue(complaint() as never);
    tx.complaint.updateMany.mockResolvedValue({ count: 0 });
    expect(await changeComplaintStatus("c1", "IN_PROGRESS")).toHaveProperty("error");
    expect(tx.complaintUpdate.create).not.toHaveBeenCalled();
    expect(notifyComplaint).not.toHaveBeenCalled();
  });

  it("rejects an unknown status", async () => {
    asUser("ADMIN", "adm");
    expect(await changeComplaintStatus("c1", "DONE")).toEqual({ error: "Unknown status" });
  });
});

describe("assignComplaint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asUser("ADMIN", "adm");
    vi.mocked(prisma.complaint.findFirst).mockResolvedValue({ id: "c1", status: "OPEN" } as never);
  });

  it("is committee-only and assigns an active committee member of the same society", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ name: "Treasurer T" } as never);
    expect(await assignComplaint("c1", "t1")).toEqual({ success: true });
    expect(requireRole).toHaveBeenCalledWith(["ADMIN", "SECRETARY", "TREASURER"]);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: "t1", societyId: "s1", isActive: true, role: { in: ["ADMIN", "SECRETARY", "TREASURER"] } },
      select: { name: true },
    });
    expect(vi.mocked(prisma.complaint.update).mock.calls[0][0].data).toMatchObject({ assignedToId: "t1" });
  });

  it("refuses a resident or someone from another society as assignee", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    expect(await assignComplaint("c1", "resident")).toEqual({ error: "Choose a committee member" });
    expect(prisma.complaint.update).not.toHaveBeenCalled();
  });

  it("can clear the assignment", async () => {
    await assignComplaint("c1", "");
    expect(vi.mocked(prisma.complaint.update).mock.calls[0][0].data).toMatchObject({ assignedToId: null });
  });
});
