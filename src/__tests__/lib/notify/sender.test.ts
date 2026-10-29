import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { society: { findUnique: vi.fn() }, user: { findMany: vi.fn() } } }));

import { prisma } from "@/lib/prisma";
import { MAX_REPLY_TO, pickReplyTo, senderCache, societySender } from "@/lib/notify/sender";

const d = (n: number) => new Date(2026, 0, n);
const members = [
  { email: "admin@x.com", role: "ADMIN" as const, createdAt: d(1) },
  { email: "Sec@X.com", role: "SECRETARY" as const, createdAt: d(2) },
  { email: "treasurer2@x.com", role: "TREASURER" as const, createdAt: d(5) },
  { email: "treasurer1@x.com", role: "TREASURER" as const, createdAt: d(3) },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.society.findUnique).mockResolvedValue({ name: "Shanti Niwas CHS" } as never);
  vi.mocked(prisma.user.findMany).mockResolvedValue(members as never);
});

describe("pickReplyTo", () => {
  it("puts treasurers first for dues, oldest member first", () => {
    expect(pickReplyTo(members, "dues")).toEqual(["treasurer1@x.com", "treasurer2@x.com"]);
  });
  it("puts the secretary first for notices and complaints, lowercased", () => {
    expect(pickReplyTo(members, "general")).toEqual(["sec@x.com", "admin@x.com"]);
  });
  it("caps and de-duplicates the list", () => {
    const dupes = [...members, { email: "ADMIN@x.com", role: "ADMIN" as const, createdAt: d(9) }];
    expect(pickReplyTo(dupes, "general")).toHaveLength(MAX_REPLY_TO);
    expect(pickReplyTo([{ email: "a@x.com", role: "OWNER", createdAt: d(1) }], "dues")).toEqual([]);
  });
});

describe("societySender", () => {
  it("uses the society's name and only active, verified committee members", async () => {
    expect(await societySender("s1", "dues")).toEqual({ fromName: "Shanti Niwas CHS", replyTo: ["treasurer1@x.com", "treasurer2@x.com"] });
    expect(vi.mocked(prisma.user.findMany).mock.calls[0][0]!.where).toEqual({
      societyId: "s1", isActive: true, emailVerifiedAt: { not: null }, role: { in: ["TREASURER", "ADMIN", "SECRETARY"] },
    });
  });

  it("gives no reply address when none is wanted or none exists", async () => {
    expect(await societySender("s1", null)).toEqual({ fromName: "Shanti Niwas CHS" });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    expect(await societySender("s1", "general")).toEqual({ fromName: "Shanti Niwas CHS" });
  });

  it("never throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.society.findUnique).mockRejectedValue(new Error("db"));
    expect(await societySender("s1", "dues")).toEqual({});
  });

  it("is looked up once per society in a batch", async () => {
    const forSociety = senderCache("dues");
    await Promise.all([forSociety("s1"), forSociety("s1"), forSociety("s2")]);
    expect(prisma.society.findUnique).toHaveBeenCalledTimes(2);
  });
});
