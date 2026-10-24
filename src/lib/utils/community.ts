// Labels and pure rules for notices, community posts and complaints.
import type {
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  NoticeCategory,
  PostCategory,
} from "@prisma/client";

export const NOTICE_LABELS: Record<NoticeCategory, string> = {
  GENERAL: "General",
  MEETING: "Meeting",
  MAINTENANCE_WORK: "Maintenance work",
  EVENT: "Event",
  RULES: "Rules",
  EMERGENCY: "Emergency",
};
export const NOTICE_CATEGORIES = Object.keys(NOTICE_LABELS) as NoticeCategory[];

export const POST_LABELS: Record<PostCategory, string> = {
  GENERAL: "General",
  RECOMMENDATION: "Recommendation",
  BUY_SELL: "Buy / sell",
  LOST_FOUND: "Lost & found",
  EVENT: "Event",
  HELP: "Help needed",
};
export const POST_CATEGORIES = Object.keys(POST_LABELS) as PostCategory[];

export const COMPLAINT_LABELS: Record<ComplaintCategory, string> = {
  PLUMBING: "Plumbing",
  ELECTRICAL: "Electrical",
  LIFT: "Lift",
  SECURITY: "Security",
  CLEANING: "Cleaning",
  PARKING: "Parking",
  NOISE: "Noise",
  WATER: "Water supply",
  GARDEN: "Garden",
  OTHER: "Other",
};
export const COMPLAINT_CATEGORIES = Object.keys(COMPLAINT_LABELS) as ComplaintCategory[];

export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const PRIORITY_LABELS: Record<ComplaintPriority, string> = { NORMAL: "Normal", URGENT: "Urgent" };

// Limits (kept here so forms and actions agree)
export const NOTICE_TITLE_MAX = 120;
export const NOTICE_BODY_MAX = 4000;
export const POST_BODY_MAX = 2000;
export const COMMENT_BODY_MAX = 500;
export const COMPLAINT_TITLE_MAX = 120;
export const COMPLAINT_BODY_MAX = 2000;
export const UPDATE_BODY_MAX = 1000;
export const MAX_POSTS_PER_DAY = 10;
export const MAX_COMMENTS_PER_DAY = 40;
export const MAX_OPEN_COMPLAINTS = 15;
export const REOPEN_WINDOW_DAYS = 14;
export const AUTO_CLOSE_AFTER_DAYS = 7;
export const MAX_COMPLAINT_PHOTOS = 3;

export type Actor = "committee" | "raiser";

/**
 * Who may move a complaint to which status.
 * Committee: OPEN → IN_PROGRESS → RESOLVED (and back to IN_PROGRESS if more work is needed).
 * Raiser: confirm a resolved complaint (→ CLOSED) or reopen a resolved/closed one (→ OPEN).
 */
export function canTransition(from: ComplaintStatus, to: ComplaintStatus, actor: Actor): boolean {
  if (from === to) return false;
  if (actor === "committee") {
    const allowed: Record<ComplaintStatus, ComplaintStatus[]> = {
      OPEN: ["IN_PROGRESS", "RESOLVED"],
      IN_PROGRESS: ["RESOLVED", "OPEN"],
      RESOLVED: ["IN_PROGRESS"],
      CLOSED: [],
    };
    return allowed[from].includes(to);
  }
  if (to === "CLOSED") return from === "RESOLVED";
  if (to === "OPEN") return from === "RESOLVED" || from === "CLOSED";
  return false;
}

/** The resident may reopen within the window after the complaint was resolved or closed. */
export function withinReopenWindow(since: Date | null, now: Date): boolean {
  if (!since) return false;
  return now.getTime() - since.getTime() <= REOPEN_WINDOW_DAYS * 86_400_000;
}

export function noticeIsLive(n: { expiresOn: Date | null; deletedAt: Date | null }, now: Date): boolean {
  return !n.deletedAt && (!n.expiresOn || n.expiresOn.getTime() >= now.getTime());
}

/** Plain text kept tidy: trims, normalises line breaks and limits blank lines. */
export function cleanText(s: string): string {
  return s.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

/** "5 min ago", "3 h ago", "2 d ago", then the date. */
export function timeAgo(date: Date, now: Date): string {
  const s = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)} d ago`;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
