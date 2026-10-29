// Small emoji touches for headings, categories and greetings. Decorative only: the words
// carry the meaning, so labels and stored values never include them.
import type { ComplaintCategory, ComplaintStatus, DocumentCategory, NoticeCategory, PostCategory } from "@prisma/client";

export const NOTICE_EMOJI: Record<NoticeCategory, string> = {
  GENERAL: "📢",
  MEETING: "🗓️",
  MAINTENANCE_WORK: "🔧",
  EVENT: "🎊",
  RULES: "📜",
  EMERGENCY: "🚨",
};

export const POST_EMOJI: Record<PostCategory, string> = {
  GENERAL: "💬",
  RECOMMENDATION: "⭐",
  BUY_SELL: "🛍️",
  LOST_FOUND: "🔎",
  EVENT: "🎉",
  HELP: "🙋",
};

export const COMPLAINT_EMOJI: Record<ComplaintCategory, string> = {
  PLUMBING: "🚰",
  ELECTRICAL: "💡",
  LIFT: "🛗",
  SECURITY: "🛡️",
  CLEANING: "🧹",
  PARKING: "🚗",
  NOISE: "🔊",
  WATER: "💧",
  GARDEN: "🌳",
  OTHER: "📝",
};

export const STATUS_EMOJI: Record<ComplaintStatus, string> = {
  OPEN: "🟡",
  IN_PROGRESS: "🛠️",
  RESOLVED: "✅",
  CLOSED: "🔒",
};

export const DOCUMENT_EMOJI: Record<DocumentCategory, string> = {
  BILL: "🧾",
  TAX_RECEIPT: "🏛️",
  AGREEMENT: "🤝",
  INSURANCE: "🛡️",
  MINUTES: "📝",
  BYLAWS: "📘",
  NOTICE: "📢",
  AUDIT: "🔍",
  PAYMENT_PROOF: "💳",
  COMPLAINT_PHOTO: "📸",
  OTHER: "📄",
};

/** "Good morning" and a matching emoji, using Indian time whatever the server's clock is set to. */
export function greetingFor(now: Date): { text: string; emoji: string } {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(now)) % 24;
  if (hour < 5) return { text: "Hello", emoji: "🌙" };
  if (hour < 12) return { text: "Good morning", emoji: "☀️" };
  if (hour < 17) return { text: "Good afternoon", emoji: "🌤️" };
  if (hour < 21) return { text: "Good evening", emoji: "🌆" };
  return { text: "Hello", emoji: "🌙" };
}
