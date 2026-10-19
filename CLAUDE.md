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
- `MaintenancePayment`: one row per flat per month (`@@unique([flatId, month, year])`), with status `PENDING` / `PAID` / `OVERDUE`. All dues generation goes through `generateForMonth` in `src/lib/queries/maintenance.ts`, which is idempotent.
- Residents pay through a UPI deep link (`src/lib/utils/upi.ts`) built from `Society.upiId`. Admins mark payments paid by hand, optionally with a UTR number.

### Verification, password reset and notifications
- Users must verify **both** email and mobile (6-digit OTP) before using the app. The gate is `ensureVerified` in `src/lib/session.ts` (called by `getSession`/`requireRole` and the dashboard layout); `/verify` uses `getSessionUnverified`. `SUPER_ADMIN` is exempt, and `REQUIRE_VERIFICATION=false` switches the gate off. Logic lives in `src/lib/verification.ts`; the JWT carries a `verified` flag refreshed with the rest of the token.
- OTPs (`src/lib/otp.ts`) are stored as HMACs in `OtpCode`, expire in 10 minutes, allow 5 guesses, and are throttled in the DB (60s cooldown, 5/hour per target) so limits hold across serverless instances. Forgot-password (`src/actions/password-reset.ts`) emails an OTP and never reveals whether an email exists.
- Outbound messages: `src/lib/notify/` — `email.ts` (Resend), `sms.ts` (MSG91 flow templates), `templates.ts`, `dispatch.ts` (`notifyPayments`), `schedule.ts` (which payments to message). Every send first claims a unique `NotificationLog.dedupeKey`, so cron reruns and double clicks never message twice. Only verified channels are used, and only primary residents (everyone if none is primary).
- When messages go out: new-due notices (cron, and the "notify" checkbox on Generate; never for back-filled old months), reminders at day 5/12/19 of the billing month while unpaid, a receipt on mark-paid, and manual "Remind" buttons on the Pending tab (`src/actions/notifications.ts`, once per person per day).
- Without provider keys, non-production runs log messages to the console and show the OTP on the verify screen; production fails closed.

### UPI payment reports (claims)
- Residents pay by UPI deep link, then report the UTR for the dues they selected (`submitPaymentClaim` in `src/actions/claims.ts`, UI in `report-payment-form.tsx`). This creates a `PaymentClaim` and sets `MaintenancePayment.claimId`; the amount is always computed on the server from the linked dues.
- ADMIN/TREASURER review claims on the **To verify** tab of Dues (`claims-list.tsx`): `approveClaim` marks every due in the claim `PAID` (UTR and paid-on date from the claim) and sends receipts; `rejectClaim` frees the dues (`claimId` cleared) and stores the reason for the resident. Both claim the review with a `status: SUBMITTED` guarded `updateMany`, so concurrent reviewers cannot double-process.
- Guards: only the resident's own unpaid, unclaimed dues; a UTR cannot be reused (open/approved claims or any payment); at most 10 open claims per resident. Dues under review cannot be selected again.

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
WhatsApp messages, automatic UPI payment verification, and tenant-occupancy UI beyond create/close.
