// Server-only. Tells a member their expense credit arrived. Email only; never throws.
import { prisma } from "@/lib/prisma";
import { sendEmail } from "./email";
import { expenseCreditMessage } from "./templates";
import { formatCurrency } from "@/lib/utils/month";

export async function notifyExpenseCredit(
  societyId: string,
  items: { userId: string; amount: number; expenseTitle: string }[]
): Promise<void> {
  if (items.length === 0) return;
  try {
    const [society, users] = await Promise.all([
      prisma.society.findUnique({ where: { id: societyId }, select: { name: true } }),
      prisma.user.findMany({
        where: { id: { in: items.map((i) => i.userId) }, societyId, isActive: true, emailVerifiedAt: { not: null } },
        select: { id: true, name: true, email: true },
      }),
    ]);
    const byId = new Map(users.map((u) => [u.id, u]));
    const results = await Promise.all(
      items.map((i) => {
        const u = byId.get(i.userId);
        if (!u) return Promise.resolve({ ok: true as const });
        const msg = expenseCreditMessage({
          societyName: society?.name ?? "Your society",
          name: u.name,
          amount: formatCurrency(i.amount),
          expenseTitle: i.expenseTitle,
        });
        return sendEmail({ to: u.email, ...msg });
      })
    );
    results.forEach((r) => {
      if (!r.ok) console.error("[expense-credit] email failed:", r.error);
    });
  } catch (err) {
    console.error("[expense-credit] notify failed:", err);
  }
}
