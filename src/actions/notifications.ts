"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { notifyPayments } from "@/lib/notify/dispatch";
import { dayKey } from "@/lib/notify/schedule";
import { revalidatePath } from "next/cache";

const MAX_PER_REQUEST = 200;

/** Manually remind residents about unpaid dues. At most one reminder per person per day. */
export async function sendDueReminders(formData: FormData) {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;

  const ids = [...new Set(formData.getAll("paymentId").map(String).filter(Boolean))];
  if (ids.length === 0) return { error: "Nothing to remind" };
  if (ids.length > MAX_PER_REQUEST) return { error: `Select at most ${MAX_PER_REQUEST} dues at a time` };

  const payments = await prisma.maintenancePayment.findMany({
    where: { id: { in: ids }, societyId, status: { in: ["PENDING", "OVERDUE"] } },
    select: { id: true },
  });
  if (payments.length === 0) return { error: "No unpaid dues found" };

  const today = dayKey(new Date());
  const result = await notifyPayments(
    "MANUAL_REMINDER",
    payments.map((p) => ({ paymentId: p.id, keySuffix: today })),
    societyId
  );

  revalidatePath("/dashboard/maintenance");
  return { success: true as const, ...result };
}
