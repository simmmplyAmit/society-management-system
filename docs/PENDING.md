# Pending items and decisions

Running list of work that is planned, deferred or still to be verified. Update it as items are done.
Last updated: 2026-10-20 (branch `main-22f19h`).

## 1. Members paying society expenses (step 3): built, follow-ups

Done: Advanced "paid by members" on Add expense, credit in the same transaction, self-tag approval by another admin/treasurer, reversal on delete while credit is unspent, receipt link, "Owed to members" card, credit email to the member.

- [ ] Edit an expense or its member amounts (today only delete). Needs the same credit-reversal rules.
- [ ] Deleting is blocked once a member has spent the credit on dues; a reviewed correction tool is needed (see credit corrections below).
- [ ] Optional cash reimbursement to the member (credit is dues-only by decision; revisit if members must be paid back in money).
- [ ] Upload the receipt file (today a `https://` link only).
- [ ] Recording an expense for *someone else's* credit needs no approval (only self-tagging does). Consider requiring approval for any credit above a limit, or for committee members.
- [ ] Reports: an expense funding breakdown (society funds vs member-paid) per period.
- [ ] Credit email only; no SMS (needs a DLT template).

## 2. Features decided but not built

- [ ] **Late fees.** Not implemented. Needs a policy first: flat amount or percentage, grace period, whether it applies to the remaining balance of part-paid dues. Reminders already chase the remaining balance.
- [ ] **Conflict-of-interest guard.** Today an admin or treasurer can approve their own payment report, mark their own flat's dues paid, or record a deposit for themselves. Proposed rule: anyone acting on dues of a flat they live in needs a different admin or treasurer, unless no other approver exists.
- [ ] **Credit corrections.** The ledger has no manual adjustment. A due paid from credit cannot be undone (blocked on purpose). A reviewed correction tool (with four-eyes approval) is needed for mistaken deposits.
- [ ] **Show each member's credit** to admins and treasurers (for example in the Residents list and the Record a payment picker).
- [ ] **Move-out and sale.** No refunds (credit is dues-only), so decide how leftover credit is handled when someone leaves or sells.

## 2b. Other charges follow-ups

- [ ] Edit a charge (name, amount, end month, targeting). Today you can only stop it and create a new one; stopping keeps dues already raised.
- [ ] Target by wing or floor, or an explicit list of flats, and exempt individual flats.
- [ ] Bulk import of flat configuration and area (CSV or paste), and per-flat "carpet vs built-up" area if both are needed.
- [ ] A scheduled charge whose start month is in the future shows no preview of when it will first bill.
- [ ] Reverse or cancel dues already raised by a charge (for example billed to the wrong flats). Needs a reviewed tool; today dues have to be corrected by hand.
- [ ] Per-charge reports (billed vs collected) and a combined statement per flat.
- [ ] SMS wording for other charges reuses the maintenance DLT template with the charge name in the period text; register dedicated templates if wording matters.

## 2d. Other income follow-ups

Built: record bank interest, rent, donations etc. with category, date and bank reference; year view with by-type totals against expenses.

- [x] Edit an income entry; yearly cash-basis statement (dues received + other income vs expenses, by month and type).
- [ ] Statement is cash basis only: no billed-vs-collected (accrual) view, no opening/closing bank balance, and cash in hand is not separated from banked money.
- [ ] Edits to income are not logged (no history of old values).
- [ ] Deleting income is not approval-gated or logged; consider an audit trail.
- [ ] Charts like the expenses analytics; export the statement to CSV/PDF.
- [ ] Recurring income (for example a monthly hall rental or FD interest) and attaching a receipt link.

## 2e. Bank tally follow-ups (Phase 1 built)

- [ ] Opening balance and date can't be corrected after creation; add a reviewed correction (second person) or a deactivate-and-recreate flow.
- [ ] Deactivate or rename a bank account; move an expense/income/deposit to another account.
- [ ] Member payments are dated by when they were recorded, not when the money arrived. Add a received date so the tally matches statement dates.
- [ ] Approved UPI reports always go to the primary account; let the approver choose when there are several accounts.
- [ ] Phase 2: Kotak password-protected PDF import (needs a sample statement), then matching and month close.
- [ ] Cheque bounce / reversal of a bank deposit.

## 2f. Documents follow-ups (library built)

- [x] Files can be attached to expenses and income entries. [ ] Attach to payment reports (proof of payment) and bank imports; show the linked expense/income on the Documents page; migrate old `receiptUrl` links; deleting an expense could offer to delete its files too.
- [ ] Renewal reminders (email to the committee) for documents with an expiry date.
- [ ] Resize and compress phone photos in the browser before upload.
- [ ] Virus scanning (not available on serverless; consider R2 + a scanning service, or restrict to committee uploads as now).
- [ ] Edit title, type, visibility or expiry; replace a file with a new version; restore a deleted file from the UI.
- [x] Tags and search (title, file name, tags) are built. [ ] Folders per year; bulk upload; rename/merge a tag across all documents.
- [ ] Per-society quota is a single env value; make it per plan.
- [ ] Verify with a real R2 bucket: signed PUT/GET, CORS and the 'WHEN_REQUIRED' checksum setting have only been unit tested.

## 2c. Cash handling follow-ups

- [ ] **Void or correct a cash receipt** (wrong amount or payer). Needs a reversal of the credit and any dues it paid, with a second person's approval; today receipts cannot be edited.
- [ ] Printable or shareable receipt (PDF) with the receipt number, and a receipt message to the payer that mentions "cash, receipt #N".
- [ ] Alert (email/SMS) to admins and treasurers when cash has been in someone's hands for several days; today it is only highlighted on the Cash tab.
- [ ] Hand-over of cash between committee members before banking (so a deposit is always made by the holder, or the transfer is recorded).
- [ ] Reconcile deposits against the bank statement (import) instead of manual confirmation. Planned: see `docs/plans/bank-reconciliation.md` (bank balance tally + statement import; Kotak password-protected PDF is required; needs a sample statement).
- [ ] Cash report: collected vs deposited by month and by collector, for audits.
- [ ] A treasurer collecting cash from themselves, or confirming their own deposit, is only partly blocked (confirmation needs another person; collection does not).

## 3. Notifications and messaging gaps

- [ ] Notify the treasurer or admin when a resident reports a payment (today they only see the "To verify" badge).
- [ ] Notify the resident when their report is rejected (today they see a banner in the app).
- [ ] SMS alerts for UPI ID changes (needs another DLT-approved template; email only today).
- [ ] Reminders stop after day 19 of the billing month; long-overdue dues only get manual reminders.
- [ ] **WhatsApp** (WhatsApp Business API via a provider such as Gupshup, Twilio, MSG91 or Meta Cloud API). More convenient than SMS and cheaper; needs Meta business verification and approved templates. It does not add security.
- [ ] A **signed pay page** (`/pay/<token>`) to put in SMS/email instead of raw `upi://` links, which many SMS apps do not open.

## 4. Payments: automatic confirmation (option B/C from the UPI discussion)

- [ ] Payment gateway with per-society settlement (Razorpay Route or Cashfree Easy Split): webhook marks dues paid. Needs a gateway choice, KYC per society and webhook signature and amount checks.
- [ ] Or virtual accounts per flat (Razorpay Smart Collect, Cashfree) for automatic reconciliation.
- [ ] Money must settle in each society's own bank account, not through the platform.
- [ ] Legal check before launch that "credit" stays outside RBI prepaid-instrument rules: money stays in the society's account, no withdrawal or transfer in the app, usable only for that society's dues.

## 5. Security and operations

- [ ] **UPI ID break-glass:** a society whose only admin loses access cannot change its UPI ID. Add a super-admin override, or document the manual database fix.
- [ ] Login rate limiting is in memory (per serverless instance). Move to a shared store (for example Upstash) before real traffic.
- [ ] A real second factor, or lockout alerts, for admin accounts (email and mobile verification helps but is not a second factor).
- [ ] Review the `SECRETARY` role's permissions across all actions.
- [ ] Run `/security-review` on the full branch before launch.

## 6. Deployment checklist (nothing deployed yet)

- [ ] Open the PR `main-22f19h` into `main` (the GitHub tool failed earlier: "invalid session"; use https://github.com/simmmplyAmit/society-management-system/compare/main...main-22f19h) and merge.
- [ ] Neon production database (pooled URL, region near users). Run `npx prisma migrate deploy`. Migrations added in this work: `add_otp_and_notifications`, `add_payment_claims`, `add_upi_change_requests`, `add_credit_ledger_and_part_payments`, `add_cash_collections`, `add_expense_contributions`, `add_special_charges` (changes the dues unique key to include a charge key; existing rows get `chargeKey = MAINTENANCE`).
- [ ] Vercel project with env vars: `DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`, `AUTH_TRUST_HOST=true`, `APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_OTP`, `MSG91_TEMPLATE_DUE`, `MSG91_TEMPLATE_RECEIPT` (see `.env.example`).
- [ ] Verify the Resend sending domain; register the three MSG91 DLT templates (text in `.env.example`) and confirm the exact flow request format and variable names against MSG91's docs (written from memory).
- [ ] **Existing users are locked out until they verify email and mobile.** Set `REQUIRE_VERIFICATION=false` until the providers work, then remove it.
- [ ] **Verify Neon transactions:** the credit ledger uses `$transaction` with `SELECT … FOR UPDATE`. Tested only against local Postgres; do one real approval on Neon first.
- [ ] Vercel Hobby is non-commercial and limits cron runtime (`maxDuration` is set to 60 s). Move to Pro once charging societies.
- [ ] Check in Vercel that the daily cron is registered and that `/api/cron/generate-maintenance` returns 401 without the token.
- [ ] First deploy only announces dues created in the last 2 days, so no blast to existing dues is expected. Confirm.

## 7. Housekeeping and quality

- [ ] Lint warning: unused `ROLE_ROUTES` in `src/proxy.ts`.
- [ ] Vitest warns that the `vite-tsconfig-paths` plugin is no longer needed (`resolve.tsconfigPaths: true`); remove the dependency.
- [ ] PWA icons in `public/icons/` are placeholders; replace with real branding.
- [ ] Dark mode was not redesigned (the new colour tokens cover the light theme only).
- [ ] The Society, Help and super-admin pages only got a light restyle; review them on a phone.
- [ ] Only unit tests exist (node environment, mocked database). Add component and end-to-end tests (Playwright) for the money flows: report, approve, part-payment, credit, UPI change.
- [ ] Update `README.md` (roles, new flows, env vars) to match `CLAUDE.md`.
- [ ] Expense analytics: optional stacked category-by-year chart.
- [ ] The imported expenses (245 rows from `Society Maintainance.xlsx`) live only in the developer's database; the spreadsheet is git-ignored.

## 8. Decisions already made (for reference)

- Email via **Resend**, SMS via **MSG91**; verification requires **both** email and mobile; super-admin is exempt.
- A UPI ID change needs a **different admin or treasurer** to approve; every change is logged and emailed; requests lapse after 7 days.
- Residents report **any amount paid**; the treasurer confirms the amount actually received.
- Credit is **per user**, applied to dues **automatically**, usable **only against dues** (no refunds or withdrawals).
- Part-paid dues stay open for the **remaining balance** and are included in reminders.
- The **owner is responsible for dues**: messages go to owners (tenants only if no owner is linked); automatic credit spending targets flats the member owns (or flats with no owner).
- Committee members who own flats get a **My dues** tab and **My flats** list.
- Hosting plan: Vercel + Neon first (cheapest); AWS later as a learning project if wanted.
