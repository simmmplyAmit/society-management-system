// Pure aggregation for the yearly income and expense statement (cash basis).
// Money in = deposits (UPI, cash, cheque) + other income. Expenses paid by members are
// settled by crediting their dues, so no cash moves: they are shown but not deducted.

export interface StatementInput {
  deposits: { amount: number; date: Date }[];
  incomes: { amount: number; date: Date; category: string }[];
  expenses: { amount: number; date: Date; category: string }[];
  memberPaid: { amount: number; date: Date }[]; // approved member contributions, dated by expense
}

export interface StatementMonth {
  month: number; // 1-12
  dues: number;
  otherIncome: number;
  expenses: number;
  memberPaid: number;
  net: number;
}

export interface Statement {
  months: StatementMonth[];
  totals: Omit<StatementMonth, "month">;
  incomeByCategory: { category: string; total: number }[];
  expenseByCategory: { category: string; total: number }[];
}

const toPaise = (n: number) => Math.round(n * 100);

export function buildStatement(input: StatementInput): Statement {
  const m = Array.from({ length: 12 }, () => ({ dues: 0, otherIncome: 0, expenses: 0, memberPaid: 0 }));
  const inc = new Map<string, number>();
  const exp = new Map<string, number>();

  for (const d of input.deposits) m[d.date.getMonth()].dues += toPaise(d.amount);
  for (const i of input.incomes) {
    m[i.date.getMonth()].otherIncome += toPaise(i.amount);
    inc.set(i.category, (inc.get(i.category) ?? 0) + toPaise(i.amount));
  }
  for (const e of input.expenses) {
    m[e.date.getMonth()].expenses += toPaise(e.amount);
    exp.set(e.category, (exp.get(e.category) ?? 0) + toPaise(e.amount));
  }
  for (const c of input.memberPaid) m[c.date.getMonth()].memberPaid += toPaise(c.amount);

  const months = m.map((x, idx) => ({
    month: idx + 1,
    dues: x.dues / 100,
    otherIncome: x.otherIncome / 100,
    expenses: x.expenses / 100,
    memberPaid: x.memberPaid / 100,
    net: (x.dues + x.otherIncome - (x.expenses - x.memberPaid)) / 100,
  }));
  const sum = (k: "dues" | "otherIncome" | "expenses" | "memberPaid") =>
    Math.round(months.reduce((n, x) => n + x[k] * 100, 0)) / 100;
  const totals = {
    dues: sum("dues"),
    otherIncome: sum("otherIncome"),
    expenses: sum("expenses"),
    memberPaid: sum("memberPaid"),
    net: Math.round(months.reduce((n, x) => n + x.net * 100, 0)) / 100,
  };
  const rank = (mp: Map<string, number>) =>
    [...mp].map(([category, p]) => ({ category, total: p / 100 })).sort((a, b) => b.total - a.total);
  return { months, totals, incomeByCategory: rank(inc), expenseByCategory: rank(exp) };
}
