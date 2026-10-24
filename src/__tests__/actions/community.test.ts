import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { create: vi.fn(), count: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
    postComment: { create: vi.fn(), count: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/session", () => ({
  requireRole: vi.fn().mockResolvedValue({ user: { id: "u1", role: "OWNER", societyId: "s1" } }),
}));

import { createPost, addComment, deletePost, deleteComment } from "@/actions/community";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const fd = (f: Record<string, string>) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  return d;
};
const asRole = (role: string, id = "u1") => vi.mocked(requireRole).mockResolvedValue({ user: { id, role, societyId: "s1" } } as never);

describe("createPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asRole("OWNER");
    vi.mocked(prisma.post.count).mockResolvedValue(0);
  });

  it("is open to every society role and posts under the session's identity", async () => {
    expect(await createPost(fd({ body: "Anyone know a good plumber?", category: "HELP", societyId: "other", authorId: "x" }))).toEqual({ success: true });
    expect(requireRole).toHaveBeenCalledWith(["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"]);
    expect(prisma.post.create).toHaveBeenCalledWith({ data: { societyId: "s1", authorId: "u1", category: "HELP", body: "Anyone know a good plumber?" } });
  });

  it("limits posts per day", async () => {
    vi.mocked(prisma.post.count).mockResolvedValue(10);
    expect(await createPost(fd({ body: "one more" }))).toHaveProperty("error");
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it.each([["empty", ""], ["too long", "x".repeat(2001)]])("rejects %s text", async (_n, body) => {
    expect(await createPost(fd({ body }))).toHaveProperty("error");
    expect(prisma.post.create).not.toHaveBeenCalled();
  });
});

describe("addComment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asRole("TENANT");
    vi.mocked(prisma.post.findFirst).mockResolvedValue({ id: "p1" } as never);
    vi.mocked(prisma.postComment.count).mockResolvedValue(0);
  });

  it("only comments on an active post of the same society", async () => {
    await addComment(fd({ postId: "p1", body: "Thanks!" }));
    expect(prisma.post.findFirst).toHaveBeenCalledWith({ where: { id: "p1", societyId: "s1", status: "ACTIVE" }, select: { id: true } });
    expect(prisma.postComment.create).toHaveBeenCalledWith({ data: { societyId: "s1", postId: "p1", authorId: "u1", body: "Thanks!" } });
  });

  it("refuses hidden or foreign posts", async () => {
    vi.mocked(prisma.post.findFirst).mockResolvedValue(null);
    expect(await addComment(fd({ postId: "x", body: "hi" }))).toEqual({ error: "That post is no longer available" });
    expect(prisma.postComment.create).not.toHaveBeenCalled();
  });

  it("limits comments per day", async () => {
    vi.mocked(prisma.postComment.count).mockResolvedValue(40);
    expect(await addComment(fd({ postId: "p1", body: "hi" }))).toHaveProperty("error");
  });
});

describe("deletePost / deleteComment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lets an author delete their own post outright, scoped by society and author", async () => {
    asRole("OWNER");
    vi.mocked(prisma.post.deleteMany).mockResolvedValue({ count: 1 });
    expect(await deletePost("p1")).toMatchObject({ success: true });
    expect(prisma.post.deleteMany).toHaveBeenCalledWith({ where: { id: "p1", societyId: "s1", authorId: "u1" } });
    expect(prisma.post.updateMany).not.toHaveBeenCalled();
  });

  it("stops a resident deleting someone else's post", async () => {
    asRole("TENANT");
    vi.mocked(prisma.post.deleteMany).mockResolvedValue({ count: 0 });
    expect(await deletePost("p1")).toEqual({ error: "You can only delete your own posts" });
    expect(prisma.post.updateMany).not.toHaveBeenCalled();
  });

  it("lets the committee hide another member's post with a reason, keeping the record", async () => {
    asRole("SECRETARY", "sec");
    vi.mocked(prisma.post.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.post.updateMany).mockResolvedValue({ count: 1 });
    expect(await deletePost("p1", "  spam  ")).toMatchObject({ success: true });
    expect(prisma.post.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", societyId: "s1", status: "ACTIVE" },
      data: { status: "HIDDEN", hiddenById: "sec", hiddenAt: expect.any(Date), hiddenReason: "spam" },
    });
  });

  it("applies the same rules to comments", async () => {
    asRole("OWNER");
    vi.mocked(prisma.postComment.deleteMany).mockResolvedValue({ count: 0 });
    expect(await deleteComment("c1")).toEqual({ error: "You can only delete your own comments" });
    asRole("ADMIN", "adm");
    vi.mocked(prisma.postComment.updateMany).mockResolvedValue({ count: 1 });
    expect(await deleteComment("c1")).toMatchObject({ success: true });
    expect(prisma.postComment.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", societyId: "s1", status: "ACTIVE" },
      data: { status: "HIDDEN", hiddenById: "adm" },
    });
  });
});
