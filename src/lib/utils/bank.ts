// Pure arithmetic for the expected bank balance (whole paise, like the credit ledger).

const toPaise = (n: number) => Math.round(n * 100);

export interface BankBalanceInput {
  openingBalance: number;
  /** Money that reached the bank: UPI / cheque / transfer deposits from members. */
  memberDeposits: number;
  /** Cash receipts banked via a cash deposit slip. */
  cashDeposits: number;
  /** Other income received into the account. */
  otherIncome: number;
  /** Expenses paid from the account: the society's share only (member-paid parts excluded). */
  expensesPaid: number;
}

export interface BankBalance extends BankBalanceInput {
  moneyIn: number;
  moneyOut: number;
  expected: number;
}

export function computeExpectedBalance(i: BankBalanceInput): BankBalance {
  const moneyIn = toPaise(i.memberDeposits) + toPaise(i.cashDeposits) + toPaise(i.otherIncome);
  const moneyOut = toPaise(i.expensesPaid);
  return {
    ...i,
    moneyIn: moneyIn / 100,
    moneyOut: moneyOut / 100,
    expected: (toPaise(i.openingBalance) + moneyIn - moneyOut) / 100,
  };
}

/** The society's own share of an expense: total less what members paid and were credited for. */
export function societyShare(amount: number, memberPaid: number): number {
  return Math.max(toPaise(amount) - toPaise(memberPaid), 0) / 100;
}

export function differenceOf(statementBalance: number, expected: number): number {
  return (toPaise(statementBalance) - toPaise(expected)) / 100;
}
