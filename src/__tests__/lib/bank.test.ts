import { describe, it, expect } from "vitest";
import { computeExpectedBalance, societyShare, differenceOf } from "@/lib/utils/bank";

describe("computeExpectedBalance", () => {
  it("adds money in and deducts money out from the opening balance", () => {
    const b = computeExpectedBalance({ openingBalance: 100000, memberDeposits: 25000.5, cashDeposits: 5000, otherIncome: 1250.25, expensesPaid: 18000 });
    expect(b.moneyIn).toBe(31250.75);
    expect(b.moneyOut).toBe(18000);
    expect(b.expected).toBe(113250.75);
  });

  it("is just the opening balance when nothing happened", () => {
    expect(computeExpectedBalance({ openingBalance: 500, memberDeposits: 0, cashDeposits: 0, otherIncome: 0, expensesPaid: 0 }).expected).toBe(500);
  });

  it("avoids floating point drift", () => {
    const b = computeExpectedBalance({ openingBalance: 0.1, memberDeposits: 0.2, cashDeposits: 0, otherIncome: 0, expensesPaid: 0 });
    expect(b.expected).toBe(0.3);
  });

  it("can go negative when spending exceeds the balance", () => {
    expect(computeExpectedBalance({ openingBalance: 100, memberDeposits: 0, cashDeposits: 0, otherIncome: 0, expensesPaid: 250 }).expected).toBe(-150);
  });
});

describe("societyShare", () => {
  it("deducts what members paid", () => expect(societyShare(1000, 250.5)).toBe(749.5));
  it("never goes below zero", () => expect(societyShare(100, 150)).toBe(0));
});

describe("differenceOf", () => {
  it("is statement minus expected", () => {
    expect(differenceOf(1000, 900)).toBe(100);
    expect(differenceOf(900.1, 1000.2)).toBe(-100.1);
    expect(differenceOf(50, 50)).toBe(0);
  });
});
