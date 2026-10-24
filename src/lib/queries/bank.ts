// Server-only data access (not a "use server" file). Pass a societyId taken from the session.
import { prisma } from "@/lib/prisma";
import { computeExpectedBalance, societyShare, type BankBalance } from "@/lib/utils/bank";

export async function getBankAccounts(societyId: string) {
  const rows = await prisma.bankAccount.findMany({
    where: { societyId, isActive: true },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
  return rows.map((a) => ({ ...a, openingBalance: Number(a.openingBalance) }));
}

/**
 * Check an id from a form belongs to this society and is active. Empty means "primary account"
 * (stored as null). Returns the id to store, or an error message.
 */
export async function resolveBankAccountId(
  societyId: string,
  raw: unknown
): Promise<{ id: string | null } | { error: string }> {
  if (typeof raw !== "string" || raw === "") return { id: null };
  const acct = await prisma.bankAccount.findFirst({
    where: { id: raw, societyId, isActive: true },
    select: { id: true },
  });
  return acct ? { id: acct.id } : { error: "Choose a bank account of this society" };
}

type Account = { id: string; isPrimary: boolean; openingBalance: number; openingDate: Date };

// Records with no account belong to the primary one
const belongsTo = (a: Account) => ({
  OR: [{ bankAccountId: a.id }, ...(a.isPrimary ? [{ bankAccountId: null }] : [])],
});

/** End of the calendar day (UTC, like the dates the forms store). */
export function endOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

const num = (d: unknown) => Number(d ?? 0);

/** What the app says the account should hold at the end of `asOf`, counting from its opening date. */
export async function getBankBalance(societyId: string, account: Account, asOf: Date): Promise<BankBalance & { unconfirmedCashDeposits: number }> {
  const range = { gte: account.openingDate, lte: endOfDay(asOf) };
  const own = belongsTo(account);

  const [deposits, cash, incomes, expenses, unconfirmed] = await Promise.all([
    prisma.creditEntry.aggregate({
      where: { societyId, type: "DEPOSIT", channel: "BANK", createdAt: range, ...own },
      _sum: { amount: true },
    }),
    prisma.cashDeposit.aggregate({
      where: { societyId, depositedOn: range, ...own },
      _sum: { amount: true },
    }),
    prisma.income.aggregate({
      where: { societyId, receivedVia: "BANK", date: range, ...own },
      _sum: { amount: true },
    }),
    prisma.expense.findMany({
      where: { societyId, paidVia: "BANK", date: range, ...own },
      select: { amount: true, contributions: { where: { status: "APPROVED" }, select: { amount: true } } },
    }),
    prisma.cashDeposit.count({ where: { societyId, depositedOn: range, confirmedAt: null, ...own } }),
  ]);

  const expensesPaid =
    expenses.reduce(
      (n, e) => n + Math.round(societyShare(num(e.amount), e.contributions.reduce((m, c) => m + Math.round(num(c.amount) * 100), 0) / 100) * 100),
      0
    ) / 100;

  return {
    ...computeExpectedBalance({
      openingBalance: account.openingBalance,
      memberDeposits: num(deposits._sum.amount),
      cashDeposits: num(cash._sum.amount),
      otherIncome: num(incomes._sum.amount),
      expensesPaid,
    }),
    unconfirmedCashDeposits: unconfirmed,
  };
}

/** Physical cash the committee should be holding: unbanked receipts + cash income - cash expenses. */
export async function getCashInHand(societyId: string) {
  const [collected, income, expenses] = await Promise.all([
    prisma.cashCollection.aggregate({ where: { societyId, depositId: null }, _sum: { amount: true } }),
    prisma.income.aggregate({ where: { societyId, receivedVia: "CASH" }, _sum: { amount: true } }),
    prisma.expense.findMany({
      where: { societyId, paidVia: "CASH" },
      select: { amount: true, contributions: { where: { status: "APPROVED" }, select: { amount: true } } },
    }),
  ]);
  const spent =
    expenses.reduce(
      (n, e) => n + Math.round(societyShare(num(e.amount), e.contributions.reduce((m, c) => m + Math.round(num(c.amount) * 100), 0) / 100) * 100),
      0
    ) / 100;
  const receipts = num(collected._sum.amount);
  const cashIncome = num(income._sum.amount);
  return {
    receipts,
    cashIncome,
    cashExpenses: spent,
    total: Math.round((receipts + cashIncome - spent) * 100) / 100,
  };
}

export async function getBalanceChecks(societyId: string, limit = 10) {
  const rows = await prisma.bankBalanceCheck.findMany({
    where: { societyId },
    include: { recordedBy: { select: { name: true } }, bankAccount: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    accountName: r.bankAccount.name,
    asOf: r.asOf,
    statementBalance: Number(r.statementBalance),
    expectedBalance: Number(r.expectedBalance),
    difference: Number(r.difference),
    note: r.note,
    recordedBy: r.recordedBy.name,
    createdAt: r.createdAt,
  }));
}
