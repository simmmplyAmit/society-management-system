"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { emailNotice } from "@/lib/notify/community";
import { NOTICE_BODY_MAX, NOTICE_CATEGORIES, NOTICE_TITLE_MAX, cleanText } from "@/lib/utils/community";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const COMMITTEE = ["ADMIN", "SECRETARY", "TREASURER"] as const;

const noticeSchema = z.object({
  title: z.string().trim().min(3, "Give the notice a title").max(NOTICE_TITLE_MAX),
  body: z.string().transform(cleanText).pipe(z.string().min(3, "Write the notice").max(NOTICE_BODY_MAX, `Keep it under ${NOTICE_BODY_MAX} characters`)),
  category: z.enum(NOTICE_CATEGORIES as [string, ...string[]]).default("GENERAL"),
  expiresOn: z.string().optional(),
});

function paths() {
  revalidatePath("/dashboard/notices");
  revalidatePath("/dashboard");
}

function parseExpiry(raw: string | undefined): Date | null | "invalid" {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

/** Post a notice. With "notify", residents with a verified email also get it by email, once. */
export async function createNotice(formData: FormData) {
  const session = await requireRole([...COMMITTEE]);
  const societyId = session.user.societyId!;

  const parsed = noticeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const expiresOn = parseExpiry(parsed.data.expiresOn);
  if (expiresOn === "invalid") return { error: "Enter a valid expiry date" };

  const category = parsed.data.category as (typeof NOTICE_CATEGORIES)[number];
  const notice = await prisma.notice.create({
    data: {
      societyId,
      title: parsed.data.title,
      body: parsed.data.body,
      category,
      pinned: formData.get("pinned") === "on",
      expiresOn,
      authorId: session.user.id,
    },
    select: { id: true },
  });

  let emailed: { sent: number; failed: number; capped: boolean } | null = null;
  if (formData.get("notify") === "on") {
    // Claim the send first so a double click or retry can never email everyone twice
    const claimed = await prisma.notice.updateMany({
      where: { id: notice.id, societyId, emailedAt: null },
      data: { emailedAt: new Date() },
    });
    if (claimed.count === 1) {
      emailed = await emailNotice({ societyId, title: parsed.data.title, body: parsed.data.body, category });
    }
  }
  paths();
  return { success: true as const, noticeId: notice.id, emailed };
}

export async function updateNotice(noticeId: string, formData: FormData) {
  const session = await requireRole([...COMMITTEE]);
  const societyId = session.user.societyId!;

  const parsed = noticeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const expiresOn = parseExpiry(parsed.data.expiresOn);
  if (expiresOn === "invalid") return { error: "Enter a valid expiry date" };

  const r = await prisma.notice.updateMany({
    where: { id: noticeId, societyId, deletedAt: null },
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      category: parsed.data.category as (typeof NOTICE_CATEGORIES)[number],
      pinned: formData.get("pinned") === "on",
      expiresOn,
    },
  });
  if (r.count !== 1) return { error: "Notice not found" };
  paths();
  return { success: true as const };
}

export async function setNoticePinned(noticeId: string, pinned: boolean) {
  const session = await requireRole([...COMMITTEE]);
  const r = await prisma.notice.updateMany({
    where: { id: noticeId, societyId: session.user.societyId!, deletedAt: null },
    data: { pinned },
  });
  if (r.count !== 1) return { error: "Notice not found" };
  paths();
  return { success: true as const };
}

/** Soft delete: the notice disappears for residents but the record is kept. */
export async function deleteNotice(noticeId: string) {
  const session = await requireRole([...COMMITTEE]);
  const r = await prisma.notice.updateMany({
    where: { id: noticeId, societyId: session.user.societyId!, deletedAt: null },
    data: { deletedAt: new Date(), pinned: false },
  });
  if (r.count !== 1) return { error: "Notice not found" };
  paths();
  return { success: true as const, error: undefined };
}
