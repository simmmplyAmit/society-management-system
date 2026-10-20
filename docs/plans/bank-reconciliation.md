# Plan: bank balance tally and bank statement import

Status: **plan only, nothing built.** Decisions needed are in section 9.
Last updated: 2026-10-21.

## 1. Goals

1. **Tally.** Show what the society's bank balance *should* be from the app's records, compare it with the real balance on the bank statement, and explain any difference.
2. **Import.** Read a bank statement and turn its lines into society income and expenses (or match them to ones already recorded) with little typing.

Non-goals for now: automatic bank feeds, payment-gateway settlement, multi-currency, accrual accounting.

## 2. Where the app stands today

- Money in: `CreditEntry` type `DEPOSIT` (approved UPI reports, "Record a payment", cash receipts), and `Income`.
- Cash: `CashCollection` is in hand until a `CashDeposit` banks it; a different ADMIN/TREASURER confirms the deposit against the bank statement.
- Money out: `Expense`. Parts paid by members are settled with credit, so no bank money moves.
- **Gaps that block a tally:** `Expense` and `Income` do not say how they were paid or received (bank, cash, member), there is no bank account, opening balance or statement data, and `DEPOSIT` entries do not say whether the money reached the bank (UPI/cheque) or is still cash in hand (cash receipts).

## 3. Part A: tally the bank balance

### 3.1 Model

```
BankAccount        id, societyId, name, bankName, last4, openingBalance, openingDate, isActive
Expense  (+)       paidVia: BANK | CASH | MEMBER (default BANK), bankAccountId?
Income   (+)       receivedVia: BANK | CASH (default BANK), bankAccountId?
CreditEntry (+)    bankAccountId? (set for UPI/cheque/transfer deposits; null for cash receipts)
CashDeposit (+)    bankAccountId
```

Only records dated on or after `openingDate` count, so old history (for example the 245 imported expenses) never has to be reconciled.

### 3.2 Book balance (what the app says the bank holds)

```
opening balance
+ deposits that reached the bank (UPI, cheque, transfer)      DEPOSIT entries with a bank account
+ confirmed cash deposits                                      CashDeposit (CONFIRMED)
+ income received via bank
- expenses paid via bank                                       paidVia = BANK
= expected bank balance as of date D
```

Cash in hand is shown separately: cash collected minus cash deposited (already tracked), plus cash income minus cash expenses.
Member-paid expenses never touch either balance.

### 3.3 Reconciliation statement (the tally screen)

For a date D (usually month end), the treasurer enters the **closing balance from the bank statement**. The app shows:

```
Expected balance from app records        A
+ cheques/entries in the app not yet on the bank statement   (outstanding)
- bank lines not yet recorded in the app (unmatched)         (from Part B)
= Balance explained
Bank statement closing balance           B
Difference (B - explained)               should be 0
```

Without Part B, the first release is "A vs B, with the difference shown and a list of recent entries to check". With Part B, every difference is traced to named lines.

**Month close:** once the difference is 0 the period can be locked. Locking needs a *different* ADMIN/TREASURER from the one who prepared it (same four-eyes pattern as UPI and cash). Locked periods refuse edits and deletes of income, expenses and deposits dated inside them (a correction is a new dated entry).

### 3.4 Screens

- `/dashboard/bank`: accounts, expected balance, last reconciled date, difference.
- Reconciliation view per month: the statement above, lists of unmatched items on both sides.
- Society setup: add account, opening balance and date (ADMIN, four-eyes not needed for first entry; later changes logged).

## 4. Part B: read a bank statement

### 4.1 Formats, in order of effort

| Format | Plan |
|---|---|
| **CSV / XLS(X)** from net banking | Phase 2. Reliable, every Indian bank offers it. |
| Text PDF | Phase 4, per-bank parsers, brittle; offer only if users cannot get CSV. |
| Scanned PDF / photo | Out of scope (OCR is unreliable for money). |
| Account Aggregator / bank feeds | Later. Needs a licensed partner (Finvu, Setu, OneMoney); consent flow; paid. Removes uploads entirely. |

### 4.2 Pipeline

1. **Upload in the browser.** Parse CSV (Papaparse) or XLSX (exceljs, lazy-loaded) on the client, send only normalised rows to a server action in chunks. This avoids server body-size limits (Vercel's) and keeps unparsed spreadsheets (formulas, macros) off the server. The server re-validates every row with Zod.
2. **Detect and map columns.** Auto-detect the header row; guess date, narration, reference, debit, credit (or one signed amount column) and balance. Show the guess for confirmation; save the mapping as a per-society **bank profile** so the next upload is one click. Ship presets for HDFC, SBI, ICICI, Axis, Kotak, Bank of Baroda, Canara, Union.
3. **Normalise** to `{ date, narration, reference, debit, credit, balance }` in whole paise. Parse `dd/mm/yy(yy)` and `dd-MMM-yyyy`; reject ambiguous dates unless the profile fixes the order.
4. **Validate:** the running balance must follow from row to row (`prev + credit - debit = balance`). A break means a missing or misparsed row, so block the import and show where. The first row must agree with the opening balance or the previous import's last balance.
5. **De-duplicate.** Fingerprint = account + date + amount + direction + reference/narration + running balance, with an occurrence counter for identical lines. Re-uploading an overlapping statement adds only new lines.
6. **Stage** as `BankTransaction` rows with status `UNMATCHED | MATCHED | CREATED | IGNORED`. Nothing touches income, expenses or credit until a person confirms.

### 4.3 Matching (suggest, never auto-post)

Credits (money in):
- UTR/UPI reference in the narration matches `PaymentClaim.utrNumber`, `CreditEntry.reference` or `CashDeposit` slip number. Suggest the matching record.
- Amount equals an open payment report (same amount, date within 7 days) → suggest "approve this report" (the treasurer still approves it through the existing flow, so a different person rule is kept).
- A single deposit line equal to the sum of selected cash receipts → suggest the open `CashDeposit`.
- Narration looks like interest (`INT.PD`, `CREDIT INTEREST`) → suggest Other income "Bank interest".

Debits (money out):
- Amount and date (±3 days) match an `Expense` with `paidVia = BANK` not yet linked → suggest linking.
- Nothing matches → suggest "Create expense", prefilled with date, amount, narration and a guessed category.
- Charges (`SMS CHG`, `MIN BAL`, `ANNUAL FEE`) → Bank Charges.

**Rules that learn:** when a treasurer categorises a line, offer "always do this for narrations containing X". Stored per society (`BankRule`: pattern, kind, category). Rules only pre-select; they never post.

### 4.4 Actions on a line

Link to existing record · Create expense · Create other income · Record as member payment (opens the existing deposit flow with member, flat and UTR prefilled) · Mark as transfer between own accounts · Ignore (with note). Bulk-select for the common cases.

A created record is linked to its `BankTransaction` and carries the line's reference, so the same UTR cannot be recorded twice (extends the existing "UTR can't be reused" rule).

### 4.5 Controls (this is where fraud would hide)

- Importing and categorising: ADMIN/TREASURER only; every action scoped by `societyId`; imports are logged (who, when, file name, row count, date range, opening/closing balance).
- A bank line can be linked to at most one record (guarded `updateMany` on `status`, same pattern as claims).
- Creating *credit for a member* from a bank line follows the existing rules: a person cannot credit themselves or their own flat's dues without another approver.
- Locking a reconciled month needs a second person. Ignoring a line above a threshold (suggest ₹10,000) also needs one.
- Do not keep the uploaded file; keep parsed rows. Narrations can contain names and account numbers, so restrict to the roles above and exclude them from logs.

## 5. Data model additions (Prisma sketch)

```
model BankAccount      { id, societyId, name, bankName, last4, openingBalance, openingDate, isActive, ... }
model BankImport       { id, societyId, bankAccountId, fileName, fromDate, toDate, openingBal, closingBal, rowCount, addedCount, importedById, createdAt }
model BankTransaction  { id, societyId, bankAccountId, importId, date, narration, reference?, debit, credit, balance,
                         fingerprint, status, expenseId?, incomeId?, creditEntryId?, cashDepositId?, note?, resolvedById?, @@unique([bankAccountId, fingerprint, seq]) }
model BankProfile      { id, societyId, name, columnMap Json, dateFormat }
model BankRule         { id, societyId, pattern, kind, category?, createdById }
model ReconciliationPeriod { id, societyId, bankAccountId, month, year, statementBalance, preparedById, lockedById?, lockedAt? }
```

All tenant-scoped with `societyId`. Money columns `Decimal(12,2)`; arithmetic in paise like `ledger.ts`.

## 6. Phases

| Phase | Delivers | Size |
|---|---|---|
| **1. Tally basics** | `BankAccount`, opening balance, `paidVia`/`receivedVia` on expenses and income (forms + migration with default BANK), bank account on deposits and cash deposits, expected balance, "enter statement balance and see the difference", cash-in-hand view | 1 migration, ~6 files, tests |
| **2. CSV/XLSX import** | Client parse, column mapper + saved profiles, validation, de-dupe, staging, review list, create expense/income, link to existing | Largest; ~2 migrations |
| **3. Matching and month close** | UTR/amount matching, suggestions, learn-able rules, outstanding items, reconciliation statement, locked periods with four-eyes, audit log | |
| **4. Extras** | Text-PDF parsers per bank, multiple accounts and inter-account transfers, FD/interest handling, export of the reconciliation, Account Aggregator | Only if asked |

Phase 1 is useful alone and is a prerequisite for the rest. I would not start Phase 2 before Phase 1 has run for a month on real data, so profile presets come from real statements.

## 7. Edge cases to design for

- One bank line paying many things: a cash deposit of many receipts, or a gateway settlement of many UPI payments → one line, many records (use a split link).
- Cheque deposited then bounced: needs a reversal; same gap as "void a cash receipt" in `PENDING.md`.
- Refunds, GST on bank charges, backdated entries, value date vs transaction date.
- Same UTR on a line and a member report: the line proves the report, but the amount can differ (the treasurer corrects it, as today).
- Inter-account transfers (savings ↔ FD): shown as a pair, not income or expense.
- Existing history before the opening date, and imported expenses with no payment mode.
- Statement exported with a different date range each month (overlap handled by de-dupe).

## 8. Testing

Pure functions with unit tests (like `buildStatement`): row normalisation, date parsing, running-balance validation, fingerprint and de-dupe, matching, tally arithmetic in paise. Action tests for `requireRole`, `societyId` scoping, the second-person rules and double-link guards. Fixture CSVs per bank (anonymised) under `src/__tests__/fixtures/bank/`.

## 9. Decisions needed

1. **Bank(s)** and whether CSV/XLS exports are available (decides presets). *Default: CSV/XLSX only.*
2. **One account or several** per society at first. *Default: several allowed, no transfers yet.*
3. **Opening balance date.** *Default: first day of the month you start using it; nothing earlier is reconciled.*
4. **Cash expenses** (petty cash) allowed? *Default: yes, `paidVia = CASH`, reported separately.*
5. **Who can post and lock.** *Default: ADMIN/TREASURER post; a different one locks.*
6. **Existing expenses:** mark as bank-paid (default) or review them first.
7. **PDF statements:** needed, or is CSV enough? *Default: CSV first.*
