// Server-only. Runs credit allocation and tells residents about it.
import { prisma } from "@/lib/prisma";
import { applyCreditForSociety, type Applied } from "@/lib/ledger";
import { notifyPayments } from "@/lib/notify/dispatch";

/** A receipt for each due that credit just paid (fully or in part). Never throws. */
export async function notifyApplied(societyId: string, applied: Applied[]): Promise<void> {
  if (applied.length === 0) return;
  try {
    await notifyPayments(
      "PAYMENT_RECEIPT",
      applied.map((a) => ({ paymentId: a.paymentId, keySuffix: a.entryId })),
      societyId
    );
  } catch (err) {
    console.error("[credit] receipt failed:", err);
  }
}

/** Apply every member's existing credit to their unpaid dues in one society. Never throws. */
export async function applyCreditAndNotify(societyId: string): Promise<number> {
  try {
    const applied = await applyCreditForSociety(societyId);
    await notifyApplied(societyId, applied);
    return applied.length;
  } catch (err) {
    console.error("[credit] auto-apply failed:", err);
    return 0;
  }
}

/** For the daily cron: new dues soak up members' credit before anyone is reminded. */
export async function applyCreditAllSocieties(): Promise<number> {
  const societies = await prisma.society.findMany({ where: { isActive: true }, select: { id: true } });
  let n = 0;
  for (const s of societies) n += await applyCreditAndNotify(s.id);
  return n;
}
