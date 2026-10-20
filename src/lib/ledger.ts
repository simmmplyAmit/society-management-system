// Server-only. Member credit ledger and automatic allocation to dues.
//
// Credit is an append-only list of CreditEntry rows (balance = their sum). It is only ever
// spent against dues of flats the user is linked to, oldest first. Every mutation runs in a
// transaction that first locks the user's row, so two requests can never spend the same credit.
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

// All arithmetic is in whole paise so floating point never drifts.
const toPaise = (v: unknown) => Math.round(Number(v) * 100);
const fromPaise = (p: number) => p / 100;

export interface Applied {
  entryId: string;
  paymentId: string;
  amount: number; // rupees applied in this step
  fullyPaid: boolean;
}

export async function getCreditBalance(societyId: string, userId: string): Promise<number> {
  const r = await prisma.creditEntry.aggregate({ where: { societyId, userId }, _sum: { amount: true } });
  return Number(r._sum.amount ?? 0);
}

async function lockUser(tx: Tx, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
}

async function balancePaise(tx: Tx, societyId: string, userId: string): Promise<number> {
  const r = await tx.creditEntry.aggregate({ where: { societyId, userId }, _sum: { amount: true } });
  return toPaise(r._sum.amount ?? 0);
}

interface ApplyOptions {
  societyId: string;
  userId: string;
  actorId: string | null;
  /** Dues the member chose to pay; they are settled before any others. */
  priorityIds?: string[];
  reference?: string | null;
  paidOn?: Date;
}

/** Spend the user's credit on their unpaid dues, oldest first. Caller holds the user lock. */
async function applyTx(tx: Tx, o: ApplyOptions): Promise<Applied[]> {
  let balance = await balancePaise(tx, o.societyId, o.userId);
  if (balance <= 0) return [];

  const priority = new Set(o.priorityIds ?? []);
  const chosen = priority.size ? [{ id: { in: [...priority] } }] : [];
  const dues = await tx.maintenancePayment.findMany({
    where: {
      societyId: o.societyId,
      status: { in: ["PENDING", "OVERDUE"] },
      AND: [
        // Dues sitting in someone else's pending report are left alone
        { OR: [{ claimId: null }, ...chosen] },
        // The owner is responsible for a flat's dues, so credit spends itself on flats the member
        // owns (or flats with no owner on record). Dues they explicitly chose are always allowed.
        {
          OR: [
            { flat: { residents: { some: { userId: o.userId, type: "OWNER" as const } } } },
            {
              flat: {
                AND: [
                  { residents: { some: { userId: o.userId } } },
                  { residents: { none: { type: "OWNER" as const } } },
                ],
              },
            },
            ...chosen,
          ],
        },
      ],
    },
    select: { id: true, amount: true, amountPaid: true, month: true, year: true },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });
  dues.sort((a, b) => Number(priority.has(b.id)) - Number(priority.has(a.id))); // stable: keeps oldest-first inside each group

  const applied: Applied[] = [];
  for (const due of dues) {
    if (balance <= 0) break;
    const paid = toPaise(due.amountPaid);
    const remaining = toPaise(due.amount) - paid;
    if (remaining <= 0) continue;

    const use = Math.min(balance, remaining);
    const fullyPaid = use === remaining;
    const entry = await tx.creditEntry.create({
      data: {
        societyId: o.societyId,
        userId: o.userId,
        type: "APPLIED",
        amount: -fromPaise(use),
        paymentId: due.id,
        reference: o.reference ?? null,
        createdById: o.actorId,
      },
      select: { id: true },
    });
    await tx.maintenancePayment.update({
      where: { id: due.id },
      data: {
        amountPaid: fromPaise(paid + use),
        ...(fullyPaid
          ? {
              status: "PAID",
              paidAt: o.paidOn ?? new Date(),
              paidBy: o.actorId,
              ...(o.reference ? { utrNumber: o.reference } : {}),
            }
          : {}),
      },
    });
    balance -= use;
    applied.push({ entryId: entry.id, paymentId: due.id, amount: fromPaise(use), fullyPaid });
  }
  return applied;
}

/** Add money to the user's credit, then spend it on their dues straight away. */
export async function depositAndApply(o: ApplyOptions & {
  amount: number;
  claimId?: string | null;
  note?: string | null;
  /** Runs inside the same transaction, right after the deposit entry is written. */
  inTx?: (tx: Prisma.TransactionClient) => Promise<void>;
}): Promise<{ applied: Applied[]; balance: number }> {
  const paise = toPaise(o.amount);
  if (!(paise > 0)) throw new Error("Deposit must be positive");

  return prisma.$transaction(async (tx) => {
    await lockUser(tx, o.userId);
    await tx.creditEntry.create({
      data: {
        societyId: o.societyId,
        userId: o.userId,
        type: "DEPOSIT",
        amount: fromPaise(paise),
        claimId: o.claimId ?? null,
        reference: o.reference ?? null,
        note: o.note ?? null,
        createdById: o.actorId,
      },
    });
    if (o.inTx) await o.inTx(tx);
    const applied = await applyTx(tx, o);
    return { applied, balance: fromPaise(await balancePaise(tx, o.societyId, o.userId)) };
  });
}

/** Spend whatever credit a user already has (used when new dues appear). */
export async function applyCreditFor(societyId: string, userId: string): Promise<Applied[]> {
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    return applyTx(tx, { societyId, userId, actorId: null });
  });
}

/** Everyone in the society with credit gets it applied to any dues they now owe. */
export async function applyCreditForSociety(societyId: string): Promise<Applied[]> {
  const rows = await prisma.creditEntry.groupBy({ by: ["userId"], where: { societyId }, _sum: { amount: true } });
  const out: Applied[] = [];
  for (const r of rows) {
    if (toPaise(r._sum.amount ?? 0) > 0) out.push(...(await applyCreditFor(societyId, r.userId)));
  }
  return out;
}

/** True when any part of this due was paid from credit (so it cannot simply be "undone"). */
export async function hasCreditAllocations(societyId: string, paymentId: string): Promise<boolean> {
  const n = await prisma.creditEntry.count({ where: { societyId, paymentId, type: "APPLIED" } });
  return n > 0;
}
