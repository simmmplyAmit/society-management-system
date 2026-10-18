// Server-only. Sends due / reminder / receipt messages to flat residents.
// Every send is claimed through NotificationLog.dedupeKey first, so reruns
// (cron retries, double clicks) never message the same person twice.
import { prisma } from "@/lib/prisma";
import { flatLabel } from "@/lib/utils/flat";
import { formatCurrency, formatDate, MONTHS } from "@/lib/utils/month";
import { sendEmail } from "./email";
import { sendSms } from "./sms";
import { dueMessage, receiptMessage, type DueInfo, type Rendered } from "./templates";
import type { Channel, NotificationKind } from "@prisma/client";

export interface NotifyItem {
  paymentId: string;
  /** Distinguishes repeat sends of the same kind (reminder slot, date, paid timestamp). */
  keySuffix: string;
}

export interface NotifyResult {
  sent: number;
  failed: number;
  skipped: number;
}

const CONCURRENCY = 8;
const RETRY_FAILED_AFTER_MS = 60 * 60 * 1000;

const KEY_PREFIX: Record<NotificationKind, string> = {
  DUE_CREATED: "due",
  DUE_REMINDER: "rem",
  MANUAL_REMINDER: "man",
  PAYMENT_RECEIPT: "rcpt",
};

/** Reserve the right to send. False means someone already sent (or is sending) it. */
async function claim(data: {
  societyId: string;
  userId: string;
  paymentId: string;
  kind: NotificationKind;
  channel: Channel;
  to: string;
  dedupeKey: string;
}): Promise<boolean> {
  try {
    await prisma.notificationLog.create({ data: { ...data, status: "PENDING" } });
    return true;
  } catch (err) {
    if ((err as { code?: string }).code !== "P2002") throw err;
    // Retry earlier failures after a cool-down; never re-send SENT/PENDING rows
    const retake = await prisma.notificationLog.updateMany({
      where: {
        dedupeKey: data.dedupeKey,
        status: "FAILED",
        updatedAt: { lt: new Date(Date.now() - RETRY_FAILED_AFTER_MS) },
      },
      data: { status: "PENDING", error: null },
    });
    return retake.count === 1;
  }
}

async function runLimited<T>(tasks: (() => Promise<T>)[]): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    out.push(...(await Promise.all(tasks.slice(i, i + CONCURRENCY).map((t) => t()))));
  }
  return out;
}

export async function notifyPayments(
  kind: NotificationKind,
  items: NotifyItem[],
  societyId?: string
): Promise<NotifyResult> {
  const result: NotifyResult = { sent: 0, failed: 0, skipped: 0 };
  if (items.length === 0) return result;

  const suffix = new Map(items.map((i) => [i.paymentId, i.keySuffix]));
  const payments = await prisma.maintenancePayment.findMany({
    where: { id: { in: items.map((i) => i.paymentId) }, ...(societyId ? { societyId } : {}) },
    include: {
      society: { select: { name: true, upiId: true, hasWings: true } },
      flat: {
        include: {
          floor: { include: { wing: { select: { name: true } } } },
          residents: {
            include: {
              user: {
                select: {
                  id: true, name: true, email: true, phone: true,
                  emailVerifiedAt: true, phoneVerifiedAt: true, isActive: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const tasks: (() => Promise<void>)[] = [];

  for (const p of payments) {
    // Primary residents; if none is flagged primary, everyone linked to the flat
    const linked = p.flat.residents.filter((r) => r.user.isActive);
    const primary = linked.filter((r) => r.isPrimary);
    const recipients = (primary.length > 0 ? primary : linked).map((r) => r.user);
    if (recipients.length === 0) {
      result.skipped += 1;
      continue;
    }

    const base: Omit<DueInfo, "name"> = {
      societyName: p.society.name,
      flat: flatLabel(p.flat, p.society.hasWings),
      period: `${MONTHS[p.month - 1]} ${p.year}`,
      amount: formatCurrency(Number(p.amount)),
      upiId: p.society.upiId,
      paidOn: p.paidAt ? formatDate(p.paidAt) : undefined,
      utr: p.utrNumber,
    };

    for (const user of recipients) {
      const rendered: Rendered =
        kind === "PAYMENT_RECEIPT"
          ? receiptMessage({ ...base, name: user.name })
          : dueMessage({ ...base, name: user.name }, kind !== "DUE_CREATED");

      const targets: { channel: Channel; to: string; send: () => Promise<{ ok: boolean; error?: string }> }[] = [];
      if (user.emailVerifiedAt) {
        targets.push({ channel: "EMAIL", to: user.email, send: () => sendEmail({ to: user.email, ...rendered.email }) });
      }
      if (user.phone && user.phoneVerifiedAt) {
        const phone = user.phone;
        targets.push({ channel: "SMS", to: phone, send: () => sendSms({ to: phone, ...rendered.sms }) });
      }
      if (targets.length === 0) {
        result.skipped += 1;
        continue;
      }

      for (const t of targets) {
        tasks.push(async () => {
          const dedupeKey = `${KEY_PREFIX[kind]}:${p.id}:${user.id}:${t.channel}:${suffix.get(p.id) ?? ""}`;
          const ok = await claim({
            societyId: p.societyId, userId: user.id, paymentId: p.id,
            kind, channel: t.channel, to: t.to, dedupeKey,
          });
          if (!ok) {
            result.skipped += 1;
            return;
          }
          const res = await t.send();
          await prisma.notificationLog.update({
            where: { dedupeKey },
            data: res.ok ? { status: "SENT" } : { status: "FAILED", error: (res.error ?? "unknown").slice(0, 300) },
          });
          if (res.ok) result.sent += 1;
          else {
            result.failed += 1;
            console.error(`[notify] ${kind} ${t.channel} payment=${p.id}: ${res.error}`);
          }
        });
      }
    }
  }

  await runLimited(tasks);
  return result;
}
