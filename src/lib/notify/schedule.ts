// Server-only. Selects which payments to message; dispatch.ts does the sending.
import { prisma } from "@/lib/prisma";
import { previousMonth } from "@/lib/utils/maintenance";
import { notifyPayments, type NotifyResult } from "./dispatch";

const DAY_MS = 24 * 60 * 60 * 1000;

/** First reminder this many days after the billing month starts, then weekly. */
export const FIRST_REMINDER_DAY = 5;
export const REMINDER_INTERVAL_DAYS = 7;
export const MAX_REMINDERS = 3;

/** 1..MAX_REMINDERS when a reminder is due for this period, otherwise null. */
export function reminderSlot(month: number, year: number, now: Date): number | null {
  const start = new Date(year, month - 1, 1);
  const days = Math.floor((now.getTime() - start.getTime()) / DAY_MS);
  if (days < FIRST_REMINDER_DAY) return null;
  const slot = Math.floor((days - FIRST_REMINDER_DAY) / REMINDER_INTERVAL_DAYS) + 1;
  return slot <= MAX_REMINDERS ? slot : null;
}

/** Local calendar date, used so a manual reminder goes out at most once a day per person. */
export function dayKey(now: Date): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/**
 * "New due" notices for dues generated in the last 2 days for the current or previous
 * month. Older periods (e.g. a bulk back-fill) and imported dues are never announced automatically.
 */
export async function sendNewDueNotices(opts: { societyId?: string; now?: Date } = {}): Promise<NotifyResult> {
  const now = opts.now ?? new Date();
  const prev = previousMonth(now.getMonth() + 1, now.getFullYear());
  const payments = await prisma.maintenancePayment.findMany({
    where: {
      status: "PENDING",
      importBatchId: null,
      ...(opts.societyId ? { societyId: opts.societyId } : { society: { isActive: true } }),
      createdAt: { gte: new Date(now.getTime() - 2 * DAY_MS) },
      OR: [
        { month: now.getMonth() + 1, year: now.getFullYear() },
        { month: prev.month, year: prev.year },
      ],
    },
    select: { id: true },
  });
  return notifyPayments("DUE_CREATED", payments.map((p) => ({ paymentId: p.id, keySuffix: "" })), opts.societyId);
}

/** Automatic reminders for unpaid dues, on the schedule defined by reminderSlot(). */
export async function sendScheduledReminders(now: Date = new Date()): Promise<NotifyResult> {
  const horizon = new Date(now.getTime() - (FIRST_REMINDER_DAY + REMINDER_INTERVAL_DAYS * MAX_REMINDERS + 31) * DAY_MS);
  const payments = await prisma.maintenancePayment.findMany({
    where: {
      status: { in: ["PENDING", "OVERDUE"] },
      society: { isActive: true },
      OR: [
        { year: { gt: horizon.getFullYear() } },
        { year: horizon.getFullYear(), month: { gte: horizon.getMonth() + 1 } },
      ],
    },
    select: { id: true, month: true, year: true },
  });

  const items = payments.flatMap((p) => {
    const slot = reminderSlot(p.month, p.year, now);
    return slot ? [{ paymentId: p.id, keySuffix: String(slot) }] : [];
  });
  return notifyPayments("DUE_REMINDER", items);
}
