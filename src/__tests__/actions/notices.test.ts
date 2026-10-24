import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { notice: { create: vi.fn().mockResolvedValue({ id: "n1" }), updateMany: vi.fn() } },
}));
vi.mock("@/lib/session", () => ({
  requireRole: vi.fn().mockResolvedValue({ user: { id: "sec1", role: "SECRETARY", societyId: "s1" } }),
}));
vi.mock("@/lib/notify/community", () => ({ emailNotice: vi.fn().mockResolvedValue({ sent: 12, failed: 0, capped: false }) }));

import { createNotice, updateNotice, setNoticePinned, deleteNotice } from "@/actions/notices";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { emailNotice } from "@/lib/notify/community";

const fd = (f: Record<string, string>) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  return d;
};
const valid = { title: "Water tank cleaning", body: "Water will be off on Sunday 9-12.", category: "MAINTENANCE_WORK" };

describe("createNotice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.notice.create).mockResolvedValue({ id: "n1" } as never);
    vi.mocked(prisma.notice.updateMany).mockResolvedValue({ count: 1 });
  });

  it("is limited to the committee", async () => {
    await createNotice(fd(valid));
    expect(requireRole).toHaveBeenCalledWith(["ADMIN", "SECRETARY", "TREASURER"]);
  });

  it("stores the notice under the session's society and author, ignoring a client societyId", async () => {
    expect(await createNotice(fd({ ...valid, societyId: "other", authorId: "x", pinned: "on" }))).toMatchObject({ success: true, noticeId: "n1", emailed: null });
    expect(vi.mocked(prisma.notice.create).mock.calls[0][0].data).toMatchObject({
      societyId: "s1", authorId: "sec1", category: "MAINTENANCE_WORK", pinned: true, expiresOn: null,
    });
    expect(emailNotice).not.toHaveBeenCalled();
  });

  it("emails residents once when asked, claiming the send first", async () => {
    const r = await createNotice(fd({ ...valid, notify: "on" }));
    expect(prisma.notice.updateMany).toHaveBeenCalledWith({
      where: { id: "n1", societyId: "s1", emailedAt: null },
      data: { emailedAt: expect.any(Date) },
    });
    expect(emailNotice).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ emailed: { sent: 12 } });
  });

  it("does not email if the send was already claimed", async () => {
    vi.mocked(prisma.notice.updateMany).mockResolvedValue({ count: 0 });
    await createNotice(fd({ ...valid, notify: "on" }));
    expect(emailNotice).not.toHaveBeenCalled();
  });

  it.each([
    ["short title", { title: "ab" }],
    ["empty body", { body: "  " }],
    ["huge body", { body: "x".repeat(4001) }],
    ["unknown type", { category: "SPAM" }],
    ["bad expiry", { expiresOn: "nope" }],
  ])("rejects %s", async (_n, patch) => {
    expect(await createNotice(fd({ ...valid, ...patch }))).toHaveProperty("error");
    expect(prisma.notice.create).not.toHaveBeenCalled();
  });
});

describe("notice edits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.notice.updateMany).mockResolvedValue({ count: 1 });
  });

  it("scopes updates, pinning and deletes by society and ignores deleted notices", async () => {
    await updateNotice("n1", fd(valid));
    expect(prisma.notice.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: "n1", societyId: "s1", deletedAt: null } }));
    await setNoticePinned("n1", true);
    expect(prisma.notice.updateMany).toHaveBeenLastCalledWith({ where: { id: "n1", societyId: "s1", deletedAt: null }, data: { pinned: true } });
    await deleteNotice("n1");
    expect(prisma.notice.updateMany).toHaveBeenLastCalledWith({
      where: { id: "n1", societyId: "s1", deletedAt: null },
      data: { deletedAt: expect.any(Date), pinned: false },
    });
  });

  it("reports a notice from another society as not found", async () => {
    vi.mocked(prisma.notice.updateMany).mockResolvedValue({ count: 0 });
    expect(await deleteNotice("foreign")).toEqual({ error: "Notice not found" });
    expect(await updateNotice("foreign", fd(valid))).toEqual({ error: "Notice not found" });
  });
});
