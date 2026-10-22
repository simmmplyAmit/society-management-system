# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Multi-tenant SaaS for housing societies: onboarding, wings/floors/flats, residents, monthly maintenance dues, expenses. Mobile-first PWA.
Next.js 16 (App Router, Turbopack) · React 19 · Prisma 7 on Neon Postgres (`@prisma/adapter-neon`) · NextAuth v5 beta (credentials + JWT) · Tailwind 4 + shadcn/ui (on `@base-ui/react`) · Zod 4 · Vitest.

## Commands

```bash
npm run dev                  # next dev (PWA disabled in development)
npm run build
npm run lint                 # eslint (flat config)
npm test                     # vitest run (all tests)
npx vitest run src/__tests__/actions/expenses.test.ts   # single file
npx vitest run -t "rejects non-positive"                # single test by name
npx prisma migrate dev --name <name>                    # new migration after editing prisma/schema.prisma
npx prisma migrate deploy
npm run seed                 # demo society; set SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD to also create a super-admin
```

Env (`.env`, see `.env.example`): `DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`. Prisma's datasource URL lives in `prisma.config.ts`, not the schema.

## Architecture

### Multi-tenancy and auth
- Every tenant-scoped table has `societyId` (`Flat` keeps a denormalized copy). `User.societyId` is null only for `SUPER_ADMIN`.
- The JWT carries `id`, `role`, `societyId` (types in `src/types/next-auth.d.ts`). `src/lib/auth-token.ts` re-checks the user against the DB every 5 minutes, so deactivation logs users out and role changes apply without re-login.
- `src/proxy.ts` is Next 16's replacement for `middleware.ts`. It only handles redirects between logged-in and logged-out pages. **Role checks happen in pages and actions**, via `getSession` / `requireRole` / `requireSociety` from `src/lib/session.ts`.
- Login is rate-limited per email in memory (`src/lib/rate-limit.ts`).

Roles and what each can do are listed in README.md. In short: ADMIN manages structure, users and charges. ADMIN and TREASURER manage dues, payments and expenses. OWNER and TENANT see their own dues.

### Server actions vs queries (security rule)
- `src/actions/*.ts` are `"use server"` files. **Every export becomes a public endpoint.** Each mutation must call `requireRole([...])` first, then scope every query by `session.user.societyId`. To delete or update by id, use `deleteMany` / `updateMany` with `{ id, societyId }` so one society can't change another's rows.
- Never export read helpers from a `"use server"` file. Reads and shared server logic go in `src/lib/queries/*.ts`, which are plain modules. They take a `societyId` that the caller got from the session.
- Actions take `FormData`, validate it with Zod `safeParse(Object.fromEntries(formData))`, call `revalidatePath(...)`, and return `{ error }` or `{ success: true }`. They don't throw. Client forms call them inside `useTransition` and show the result with a `sonner` toast.

### Pages
- Server components under `src/app/(dashboard)/dashboard/*` call `requireRole`, fetch through `src/lib/queries/*` or Prisma, and render different sections depending on the role. `searchParams` is a `Promise` (Next 16), so it must be awaited.
- `/super-admin` handles society onboarding (`src/actions/super-admin.ts`).
- Navigation is mobile-first (`components/layout/bottom-nav.tsx`, `top-bar.tsx`).

### Domain model
- Society → Wing → Floor → Flat. Societies with `hasWings = false` still store a hidden `_default_` wing, which `addFloorDirect` creates automatically. Use `src/lib/utils/flat.ts` (`flatLabel`, `flatOptionLabel`) to display flats so the wing is hidden when it should be.
- `MaintenanceCharge`: a per-flat amount for a month range (`startMonth/startYear` to an optional end). Charges for the same flat must not overlap. Months are 1–12 integers. `toIdx` / `periodsOverlap` in `src/lib/utils/maintenance.ts` do month arithmetic.
- `MaintenancePayment`: one row per flat per month per charge (`@@unique([flatId, month, year, chargeKey])`), with status `PENDING` / `PAID` / `OVERDUE`. All dues generation goes through `generateForMonth` in `src/lib/queries/maintenance.ts`, which is idempotent.
- Residents pay through a UPI deep link (`src/lib/utils/upi.ts`) built from `Society.upiId`. Admins mark payments paid by hand, optionally with a UTR number.

### Expenses paid by members
- When a member pays a society expense out of pocket, the recorder tags them under **Advanced: paid by members** on Add expense (`addExpense`, `contributions` JSON). `createExpenseWithContributions` (`src/lib/expense-contributions.ts`) saves the expense, the `ExpenseContribution` rows and the credit (`EXPENSE_CREDIT` ledger entries via `depositAndApplyIn`) in **one transaction**; the credit then pays the member's dues automatically. Credit is dues-only. Amounts may add up to at most the expense total; the rest is paid from society funds.
- **No self-credit:** if the recorder tags themselves, the contribution stays `PENDING` until a *different* ADMIN/TREASURER approves it (`approveContribution` in `src/actions/expense-contributions.ts`); the recorder can withdraw it.
- Deleting such an expense takes the credit back (`EXPENSE_CREDIT_REVERSAL`) in the same transaction, but only while the member still holds that much unspent credit; otherwise it is refused (`InsufficientCreditError`). Contributions are kept as `REVERSED`/`CANCELLED` records. The Expenses page shows "Owed to members" (credit held and not yet used).

### Cash collection and deposits
- ADMIN/TREASURER take cash on the **Cash** tab of Dues (`collectCash` in `src/actions/cash.ts`): a numbered receipt (`Society.cashReceiptSeq`), a `CashCollection` row and the payer's credit top-up (`depositAndApply` with the `inTx` hook) all commit in one transaction. The credit then pays their dues automatically like any other deposit. Cash with no `depositId` is **in hand**, held by the collector.
- `depositCash` banks selected receipts as one `CashDeposit` (bank slip/reference required and unique per society). The total is computed on the server and the attach is guarded, so a receipt can only be banked once. A **different** ADMIN/TREASURER must `confirmCashDeposit` against the bank statement. Stale cash (3+ days) is flagged. "Record a bank payment" on the Pending tab is for money already in the bank (cheque/UPI/transfer).
- Entries are never edited; there is no void/reversal for a mistaken receipt yet (see `docs/PENDING.md`).

### Other income (bank interest, hall rent…)
- `Income` records money the society receives apart from dues (`addIncome` / `deleteIncome` in `src/actions/income.ts`, ADMIN/TREASURER; ADMIN/SECRETARY/TREASURER can view `/dashboard/income`). Reads are in `src/lib/queries/income.ts`. It does not touch member credit or dues. The page shows the year's other income against expenses and a by-type breakdown. Dues collected are not counted as income here. `updateIncome` edits an entry (`updateMany` scoped by `{ id, societyId }`).
- `/dashboard/income/statement` is a yearly **cash-basis** statement (`getStatement` → pure `buildStatement` in `src/lib/utils/statement.ts`): money received = `DEPOSIT` credit entries (UPI, cash, cheque, by entry date) + other income, against expenses by month and type. Expenses members paid themselves are shown but not deducted, because they are settled against those members' dues with no cash moving.

### Bank accounts and the balance tally
- `BankAccount` (name, bank, last 4, `openingBalance` at `openingDate`, `isPrimary`) is added at `/dashboard/bank` (`addBankAccount`, ADMIN/TREASURER; the first one becomes primary; the opening balance can't be edited). Nothing dated before `openingDate` is counted. Records with `bankAccountId = null` belong to the **primary** account, so existing data and UPI payments need no backfill. Forms show an account picker only when there is more than one account (`AccountFields`).
- `MoneyChannel` (`BANK`/`CASH`) is stored on `Expense.paidVia`, `Income.receivedVia` and `CreditEntry.channel`. Cash receipts (`collectCash`) are `CASH` deposits: they are not bank money until banked through a `CashDeposit`. A member-paid share of an expense (approved `ExpenseContribution`) is never deducted from the bank or cash.
- Expected balance (`getBankBalance` in `src/lib/queries/bank.ts`, arithmetic in `src/lib/utils/bank.ts`) = opening + member deposits (`DEPOSIT`, `BANK`, by entry date) + `CashDeposit`s (counted even if not yet confirmed; the page warns) + bank income − bank expenses (society's share). `getCashInHand` = unbanked receipts + cash income − cash expenses.
- `recordBalanceCheck` compares a statement balance with the expected balance **computed on the server** and keeps each result in the append-only `BankBalanceCheck` log. Plan for statement import and month close: `docs/plans/bank-reconciliation.md`.

### Documents
- `Document` rows hold metadata; the files live in a **private Cloudflare R2 bucket** (`src/lib/storage.ts`, S3 API, env `R2_*`; setup in `docs/DOCUMENT-STORAGE.md`). Nothing is public. Upload is two steps (`src/actions/documents.ts`): `requestDocumentUpload` (ADMIN/SECRETARY/TREASURER; checks type PDF/JPG/PNG/WebP, 10 MB, society quota; saves a `PENDING` row; returns a 5-minute signed PUT link) → browser PUTs to R2 → `confirmDocumentUpload` (checks stored size and the file's magic bytes via `sniffMime`, deletes the file if it isn't what it claimed, then a guarded `PENDING → READY` update).
- Each file has a **visibility**: `COMMITTEE` (default; minutes, bylaws and notices pre-select `RESIDENTS`) or `RESIDENTS`. `visibleTo(role)` in `src/lib/queries/documents.ts` applies it to every read. Downloads go through `GET /api/documents/[id]`, which checks society and visibility and redirects to a 60-second signed link.
- `TAX_RECEIPT` and `AUDIT` get `retainUntil` = +8 years and cannot be deleted before it. Delete is a soft delete (`DELETED`); the daily cron (`cleanupDocuments`) removes unconfirmed uploads after 1 hour and the stored file 30 days after deletion. Pure rules are in `src/lib/utils/documents.ts`.
- Navigation: the phone bottom bar shows the 4 highest-`rank` items plus **More** (`/dashboard/more`) when a role has more than 5 (`mobileItems` in `nav-items.ts`).

### Other charges (sinking fund, water, festival…)
- `SpecialCharge` defines a charge: **one-time** or **recurring and time-bound** (monthly/quarterly/half-yearly/yearly, start and end month required), priced **fixed per flat** or **per sq ft × flat area**, and targeted by **configuration** (e.g. 2 BHK) and/or **area range**. Flats carry `configuration` and `areaSqFt` (edited under Society → Flat details; configurations are compared with `normalizeConfig`, so "2 bhk" = "2BHK"). Pure rules live in `src/lib/utils/special-charges.ts` (shared with the form's live preview).
- Billing creates ordinary `MaintenancePayment` rows (`label` = charge name, `chargeKey` = charge id, `chargeId` null), so credit, part-payments, claims, reminders and receipts work unchanged. The unique key is `(flatId, month, year, chargeKey)`; monthly maintenance uses `chargeKey = "MAINTENANCE"`. `generateSpecialChargeDues` (`src/lib/queries/special-charges.ts`) is idempotent (`createMany` with `skipDuplicates`), runs when a charge is created, from "Bill again", and in the daily cron. Only billing months that have arrived are raised; past start months are back-filled without sending messages. Flats that can't be billed per sq ft (no area) are skipped and reported.
- Admin UI: **Other** tab on Dues (`SpecialChargeForm`, `SpecialChargesList`); stopping a charge keeps dues already raised. Amounts are fixed at billing time, so later flat edits only affect future billings.

### Multiple flats and "My dues"
- A user can be linked to several flats (`FlatResident`), as owner or tenant, whatever their role. `getMyFlats` (`src/lib/queries/flats.ts`) lists them with unpaid totals. `ResidentDues` shows an **All flats** (unified) view plus one chip per flat; `?flat=<flatId>` deep-links a flat. Dues belong to the flat, so an owner and tenant of the same flat see the same dues.
- ADMIN/SECRETARY/TREASURER who also own flats get a **My dues** tab on Dues and a **My flats** list on Home (`MyDues` component). `submitPaymentClaim` is open to every society role, scoped to flats the user is linked to.

### Verification, password reset and notifications
- Users must verify **both** email and mobile (6-digit OTP) before using the app. The gate is `ensureVerified` in `src/lib/session.ts` (called by `getSession`/`requireRole` and the dashboard layout); `/verify` uses `getSessionUnverified`. `SUPER_ADMIN` is exempt, and `REQUIRE_VERIFICATION=false` switches the gate off. Logic lives in `src/lib/verification.ts`; the JWT carries a `verified` flag refreshed with the rest of the token.
- OTPs (`src/lib/otp.ts`) are stored as HMACs in `OtpCode`, expire in 10 minutes, allow 5 guesses, and are throttled in the DB (60s cooldown, 5/hour per target) so limits hold across serverless instances. Forgot-password (`src/actions/password-reset.ts`) emails an OTP and never reveals whether an email exists.
- Outbound messages: `src/lib/notify/` — `email.ts` (Resend), `sms.ts` (MSG91 flow templates), `templates.ts`, `dispatch.ts` (`notifyPayments`), `schedule.ts` (which payments to message). Every send first claims a unique `NotificationLog.dedupeKey`, so cron reruns and double clicks never message twice. Only verified channels are used, and only primary residents (everyone if none is primary).
- When messages go out: new-due notices (cron, and the "notify" checkbox on Generate; never for back-filled old months), reminders at day 5/12/19 of the billing month while unpaid, a receipt on mark-paid, and manual "Remind" buttons on the Pending tab (`src/actions/notifications.ts`, once per person per day).
- Without provider keys, non-production runs log messages to the console and show the OTP on the verify screen; production fails closed.

### Member credit, part-payments and UPI payment reports
- Residents pay by UPI deep link, then report the **amount they paid** (any amount) and the UTR for the dues they picked (`submitPaymentClaim` in `src/actions/claims.ts`). A `PaymentClaim` is created and the picked dues get `claimId` (shown as "Awaiting verification").
- Money is held as **credit**: an append-only ledger `CreditEntry` (`DEPOSIT` +, `APPLIED` −, `REVERSAL` +); the balance is the sum per (society, user). Credit is per user and can only be spent on dues. All mutations live in `src/lib/ledger.ts`, run in a `$transaction`, lock the user row (`SELECT … FOR UPDATE`) and use whole-paise arithmetic. Never edit or delete entries.
- `depositAndApply` adds a deposit and spends it immediately: dues the member picked first, then oldest first. `MaintenancePayment.amountPaid` accumulates; the due becomes `PAID` when it reaches `amount`; until then it is a part-payment (still `PENDING`/`OVERDUE`, balance = `amount − amountPaid`, see `dueBalance` in `src/lib/utils/dues.ts`). Automatic spending (new dues, cron, `applyCreditAndNotify` in `src/lib/credit-service.ts`) only targets flats the member **owns** (or flats with no owner on record), because the owner is responsible for dues.
- ADMIN/TREASURER review reports on the **To verify** tab: `approveClaim(claimId, receivedAmount?)` credits what actually arrived (the treasurer may correct it) and applies it; `rejectClaim` frees the dues. `recordDeposit` (`src/actions/credit.ts`, "Record a payment" on the Pending tab) credits cash/cheque/UPI received outside the app. A UTR can't be reused across reports, payments and deposits. A due that was paid from credit cannot be undone with `markPaymentPending`.
- Notifications go to the flat's **owner(s)** (tenants only if no owner is linked); dues and reminders ask for the remaining balance, receipts state what was paid and any balance. Late fees are not implemented.

### UPI ID changes (four-eyes)
- `Society.upiId` decides where residents' money goes, so it is **not** editable through `updateSociety`. An ADMIN calls `requestUpiChange` (`src/actions/upi.ts`); a *different* ADMIN or TREASURER must `approveUpiChange` (the requester cannot approve their own, and a society with no other approver cannot raise a request). Only the very first UPI ID is applied immediately.
- `UpiChangeRequest` rows are the audit log (old/new ID, requester, reviewer, note, status). Pending requests lapse after 7 days; approving cancels other pending ones. Approvals/rejections atomically claim the request with a `status: PENDING` guarded `updateMany`.
- Every active, email-verified ADMIN/TREASURER is emailed on request and on decision (`src/lib/notify/upi.ts`). The UI lives at `/dashboard/upi` (ADMIN, TREASURER) with a home-page banner for approvers. Residents see a notice for 14 days after a change (`Society.upiChangedAt`).

### Cron
`GET /api/cron/generate-maintenance` requires `Authorization: Bearer $CRON_SECRET`. It runs daily on Vercel (`vercel.json`, 18:30 UTC = 00:00 IST). For every active society it generates the previous and current month's dues, marks unpaid dues from earlier months `OVERDUE`, then sends new-due notices and scheduled reminders.

## Testing

- Vitest in a node environment, with `@/` paths through `vite-tsconfig-paths`. `src/__tests__/setup.ts` mocks `next/cache`. It also mocks `next/navigation`: `redirect` throws `NEXT_REDIRECT:<url>`.
- Tests never touch a real DB. Mock `@/lib/prisma` and `@/lib/session` with `vi.mock` before importing the action. Then assert on the `requireRole` arguments and check that Prisma calls are scoped by `societyId` (`src/__tests__/actions/expenses.test.ts` is the reference pattern).
- Tests mirror the source layout: `__tests__/actions`, `__tests__/queries`, `__tests__/lib`, `__tests__/api`.

## Not yet implemented
WhatsApp messages, automatic UPI payment verification, late fees, members paying expenses, and tenant-occupancy UI beyond create/close. The full backlog and decisions are in `docs/PENDING.md`.
