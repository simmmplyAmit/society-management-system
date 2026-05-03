# Society Management System

Multi-tenant society (housing complex) management: onboarding, flats & residents, maintenance collection, expenses.
Next.js 16 (App Router) · Prisma 7 on Neon Postgres · NextAuth v5 (credentials, JWT) · Tailwind 4 + shadcn/ui · Vitest.

## Roles
`SUPER_ADMIN` (product team) · `ADMIN` · `SECRETARY` · `TREASURER` · `OWNER` · `TENANT`

| Area | Who |
|---|---|
| Onboard societies (`/super-admin`) | SUPER_ADMIN |
| Society structure, users, residents, maintenance charges | ADMIN |
| Generate dues, mark payments, add expenses | ADMIN, TREASURER |
| View expenses | ADMIN, SECRETARY, TREASURER |
| View own dues + pay via UPI link | OWNER, TENANT |

## Setup
```bash
npm install
cp .env.example .env        # fill DATABASE_URL, AUTH_SECRET, CRON_SECRET
npx prisma migrate deploy
SUPER_ADMIN_EMAIL=you@example.com SUPER_ADMIN_PASSWORD=change-me-12 npm run seed   # demo society + super-admin
npm run dev
```

## Scripts
`npm run dev` · `npm run build` · `npm test` · `npm run lint`

## Maintenance automation
`GET /api/cron/generate-maintenance` (secured with `Authorization: Bearer $CRON_SECRET`) runs daily
(`vercel.json`, 00:00 IST). For every active society it generates the previous and current month's dues
(idempotent, so a missed run is caught up) and flips unpaid dues from earlier months to `OVERDUE`.
On Vercel, set `CRON_SECRET` in project env vars — Vercel sends it automatically.

## Security conventions
- Every mutating server action calls `requireRole([...])` and scopes queries by `session.user.societyId`.
- **Never export reads or helpers from a `"use server"` file** — every export becomes a public endpoint.
  Read queries live in `src/lib/queries/*` and take a `societyId` that the calling page got from the session.
- Sessions are re-validated against the DB every 5 minutes (`src/lib/auth-token.ts`): deactivated users are logged out
  and role changes apply without re-login.
- Login is throttled per email (5 failures / 15 min, in-memory — move to Redis/Upstash for multi-instance deploys).

## Not yet implemented
Outbound reminders (email/SMS/WhatsApp), UPI payment auto-verification, tenant-occupancy UI beyond create/close.
