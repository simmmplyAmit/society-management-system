import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { society: { findUnique: vi.fn() }, user: { findMany: vi.fn() } },
}));
vi.mock("@/lib/notify/email", () => ({ sendEmail: vi.fn().mockResolvedValue({ ok: true }) }));

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/notify/email";
import { notifyUpiChange } from "@/lib/notify/upi";
import { upiChangeMessage } from "@/lib/notify/templates";

const base = {
  societyId: "s1", oldUpiId: "old@bank", newUpiId: "new@bank",
  requestedById: "a1", requestedByName: "Asha",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.society.findUnique).mockResolvedValue({ name: "Sunrise" } as never);
  vi.mocked(prisma.user.findMany).mockResolvedValue([{ email: "t@x.com" }, { email: "b@x.com" }] as never);
});

describe("notifyUpiChange", () => {
  it("asks every other verified admin/treasurer to approve, excluding the requester", async () => {
    await notifyUpiChange({ ...base, kind: "requested" });
    expect(vi.mocked(prisma.user.findMany).mock.calls[0][0]!.where).toEqual({
      societyId: "s1", isActive: true, role: { in: ["ADMIN", "TREASURER"] },
      emailVerifiedAt: { not: null }, id: { not: "a1" },
    });
    expect(vi.mocked(sendEmail).mock.calls.map((c) => c[0].to)).toEqual(["t@x.com", "b@x.com"]);
  });

  it("tells everyone (including the requester) about a decision", async () => {
    await notifyUpiChange({ ...base, kind: "approved", reviewedByName: "Tara" });
    expect(vi.mocked(prisma.user.findMany).mock.calls[0][0]!.where).not.toHaveProperty("id");
  });

  it("never throws, even if the database or provider fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.user.findMany).mockRejectedValue(new Error("db down"));
    await expect(notifyUpiChange({ ...base, kind: "requested" })).resolves.toBeUndefined();
  });
});

describe("upiChangeMessage", () => {
  it("escapes user-controlled values and warns approvers", () => {
    const m = upiChangeMessage({
      societyName: "A&B <Soc>", kind: "requested", oldUpiId: "o@b", newUpiId: "<img src=x>@bank", requestedBy: "<b>Eve</b>",
    });
    expect(m.html).not.toContain("<img");
    expect(m.html).not.toContain("<b>Eve</b>");
    expect(m.html).toContain("A&amp;B &lt;Soc&gt;");
    expect(m.text).toMatch(/Only approve if you know/);
    expect(m.subject).toMatch(/needs your approval/);
  });
});
