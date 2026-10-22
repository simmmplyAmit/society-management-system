"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { COMMITTEE_ROLES } from "@/lib/queries/documents";
import {
  COMMENT_BODY_MAX,
  MAX_COMMENTS_PER_DAY,
  MAX_POSTS_PER_DAY,
  POST_BODY_MAX,
  POST_CATEGORIES,
  cleanText,
} from "@/lib/utils/community";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const MEMBERS = ["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"] as const;
const DAY_MS = 86_400_000;

const postSchema = z.object({
  category: z.enum(POST_CATEGORIES as [string, ...string[]]).default("GENERAL"),
  body: z.string().transform(cleanText).pipe(z.string().min(2, "Write something").max(POST_BODY_MAX, `Keep it under ${POST_BODY_MAX} characters`)),
});

const commentSchema = z.object({
  postId: z.string().min(1),
  body: z.string().transform(cleanText).pipe(z.string().min(1, "Write a comment").max(COMMENT_BODY_MAX, `Keep it under ${COMMENT_BODY_MAX} characters`)),
});

function paths() {
  revalidatePath("/dashboard/community");
}

export async function createPost(formData: FormData) {
  const session = await requireRole([...MEMBERS]);
  const { id: userId, societyId } = session.user;
  if (!societyId) return { error: "No society found" };

  const parsed = postSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const recent = await prisma.post.count({ where: { authorId: userId, createdAt: { gte: new Date(Date.now() - DAY_MS) } } });
  if (recent >= MAX_POSTS_PER_DAY) return { error: "You've reached today's posting limit. Try again tomorrow" };

  await prisma.post.create({
    data: { societyId, authorId: userId, category: parsed.data.category as (typeof POST_CATEGORIES)[number], body: parsed.data.body },
  });
  paths();
  return { success: true as const };
}

export async function addComment(formData: FormData) {
  const session = await requireRole([...MEMBERS]);
  const { id: userId, societyId } = session.user;
  if (!societyId) return { error: "No society found" };

  const parsed = commentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // The post must be an active post of this society
  const post = await prisma.post.findFirst({
    where: { id: parsed.data.postId, societyId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!post) return { error: "That post is no longer available" };

  const recent = await prisma.postComment.count({ where: { authorId: userId, createdAt: { gte: new Date(Date.now() - DAY_MS) } } });
  if (recent >= MAX_COMMENTS_PER_DAY) return { error: "You've reached today's comment limit" };

  await prisma.postComment.create({ data: { societyId, postId: post.id, authorId: userId, body: parsed.data.body } });
  paths();
  return { success: true as const };
}

/**
 * Authors remove their own posts outright. The committee hides other people's posts with a reason
 * (kept as a record, shown to the committee as hidden).
 */
export async function deletePost(postId: string, reason?: string) {
  const session = await requireRole([...MEMBERS]);
  const { id: userId, societyId, role } = session.user;
  if (!societyId) return { error: "No society found" };

  const own = await prisma.post.deleteMany({ where: { id: postId, societyId, authorId: userId } });
  if (own.count === 1) {
    paths();
    return { success: true as const, error: undefined };
  }
  if (!COMMITTEE_ROLES.includes(role)) return { error: "You can only delete your own posts" };

  const r = await prisma.post.updateMany({
    where: { id: postId, societyId, status: "ACTIVE" },
    data: { status: "HIDDEN", hiddenById: userId, hiddenAt: new Date(), hiddenReason: reason?.trim().slice(0, 200) || null },
  });
  if (r.count !== 1) return { error: "Post not found" };
  paths();
  return { success: true as const, error: undefined };
}

export async function deleteComment(commentId: string) {
  const session = await requireRole([...MEMBERS]);
  const { id: userId, societyId, role } = session.user;
  if (!societyId) return { error: "No society found" };

  const own = await prisma.postComment.deleteMany({ where: { id: commentId, societyId, authorId: userId } });
  if (own.count === 1) {
    paths();
    return { success: true as const, error: undefined };
  }
  if (!COMMITTEE_ROLES.includes(role)) return { error: "You can only delete your own comments" };

  const r = await prisma.postComment.updateMany({
    where: { id: commentId, societyId, status: "ACTIVE" },
    data: { status: "HIDDEN", hiddenById: userId },
  });
  if (r.count !== 1) return { error: "Comment not found" };
  paths();
  return { success: true as const, error: undefined };
}
