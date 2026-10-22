import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { StatTile, ActionRow } from "@/components/dashboard/stat-tile";
import { formatCurrency, monthLabel } from "@/lib/utils/month";
import {
  Building2,
  Users,
  Receipt,
  TrendingDown,
  CheckCircle2,
  Clock,
  Home,
  ArrowRight,
  ShieldAlert,
  Landmark,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPendingUpiRequestFor } from "@/lib/queries/upi";
import { getMyFlats, type MyFlat } from "@/lib/queries/flats";
import { flatLabel } from "@/lib/utils/flat";
import type { Role } from "@prisma/client";

const WELCOME: Record<Role, string> = {
  SUPER_ADMIN: "Platform overview",
  ADMIN: "Society overview",
  SECRETARY: "Society overview",
  TREASURER: "Finance overview",
  OWNER: "Your home",
  TENANT: "Your home",
};

export default async function DashboardPage() {
  const session = await requireRole([
    "SUPER_ADMIN", "ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT",
  ]);
  const { role, societyId, id: userId } = session.user;
  if (role === "SUPER_ADMIN") redirect("/super-admin");

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // ─── Resident dashboard ──────────────────────────
  if (role === "OWNER" || role === "TENANT") {
    const [myFlats, soc] = await Promise.all([
      getMyFlats(societyId!, userId),
      prisma.society.findUnique({ where: { id: societyId! }, select: { hasWings: true } }),
    ]);
    const hasWings = soc?.hasWings ?? true;
    const totalDue = myFlats.reduce((n, f) => n + f.unpaidTotal, 0);
    const dueCount = myFlats.reduce((n, f) => n + f.unpaidCount, 0);

    return (
      <div className="space-y-5">
        <Greeting name={session.user.name} sub={WELCOME[role]} />

        <Link
          href="/dashboard/maintenance"
          className={`block rounded-3xl p-5 text-white shadow-lg ${
            totalDue > 0
              ? "bg-gradient-to-br from-indigo-600 to-violet-700 shadow-indigo-500/20"
              : "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20"
          }`}
        >
          <div className="flex items-center gap-2 text-sm text-white/80">
            {totalDue > 0 ? <Clock className="size-4" /> : <CheckCircle2 className="size-4" />}
            {totalDue > 0 ? "Maintenance due" : "You're all caught up"}
          </div>
          <p className="mt-2 text-4xl font-semibold tracking-tight">
            {totalDue > 0 ? formatCurrency(totalDue) : "No dues"}
          </p>
          <div className="mt-4 flex items-center justify-between text-sm text-white/85">
            <span>
              {dueCount} pending payment{dueCount !== 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1 font-medium">
              {totalDue > 0 ? "Pay now" : "View history"} <ArrowRight className="size-4" />
            </span>
          </div>
        </Link>

        <MyFlatsList flats={myFlats} hasWings={hasWings} />
      </div>
    );
  }

  // ─── Manager / Admin dashboard ───────────────────
  const [flatsCount, occupiedCount, thisMonthPayments, thisMonthExpenses, pendingCount] =
    await Promise.all([
      prisma.flat.count({ where: { societyId: societyId! } }),
      prisma.flat.count({ where: { societyId: societyId!, isOccupied: true } }),
      prisma.maintenancePayment.findMany({
        where: { societyId: societyId!, month, year },
        select: { status: true, amount: true },
      }),
      prisma.expense.aggregate({
        where: {
          societyId: societyId!,
          date: {
            gte: new Date(year, month - 1, 1),
            lte: new Date(year, month, 0, 23, 59, 59),
          },
        },
        _sum: { amount: true },
      }),
      prisma.maintenancePayment.count({
        where: { societyId: societyId!, month, year, status: "PENDING" },
      }),
    ]);

  const totalCollected = thisMonthPayments
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalDue = thisMonthPayments
    .filter((p) => p.status !== "PAID")
    .reduce((s, p) => s + Number(p.amount), 0);
  const monthExpenses = Number(thisMonthExpenses._sum.amount ?? 0);

  const billed = totalCollected + totalDue;
  const pct = billed > 0 ? Math.round((totalCollected / billed) * 100) : 0;
  const paidCount = thisMonthPayments.filter((p) => p.status === "PAID").length;
  const usersCount = await prisma.user.count({ where: { societyId: societyId! } });
  const canReviewUpi = role === "ADMIN" || role === "TREASURER";
  const pendingUpi = canReviewUpi ? await getPendingUpiRequestFor(societyId!, userId) : null;
  const [myFlats, mgrSoc] = await Promise.all([
    getMyFlats(societyId!, userId), // committee members can own flats too
    prisma.society.findUnique({ where: { id: societyId! }, select: { hasWings: true } }),
  ]);

  return (
    <div className="space-y-5">
      <Greeting name={session.user.name} sub={WELCOME[role]} />

      {pendingUpi && (
        <Link
          href="/dashboard/upi"
          className="flex items-center gap-3 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-600/20"
        >
          <ShieldAlert className="size-5 shrink-0 text-amber-700" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-amber-900">UPI ID change needs your approval</span>
            <span className="block truncate text-xs text-amber-900/80">New ID: {pendingUpi.newUpiId}. Review it before approving.</span>
          </span>
          <ArrowRight className="size-4 text-amber-700" />
        </Link>
      )}

      <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 p-5 text-white shadow-lg shadow-indigo-500/20 lg:p-7">
        <p className="text-sm text-white/80">Collected in {monthLabel(month, year)}</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight lg:text-5xl">
          {formatCurrency(totalCollected)}
        </p>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-white/80">
          <span>
            {paidCount} of {thisMonthPayments.length} flats paid
          </span>
          <span>{pct}% of {formatCurrency(billed)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          href="/dashboard/maintenance"
          label="Pending dues"
          value={pendingCount > 0 ? formatCurrency(totalDue) : "All paid"}
          sub={`${pendingCount} flat${pendingCount !== 1 ? "s" : ""}`}
          icon={pendingCount > 0 ? Clock : CheckCircle2}
          tone={pendingCount > 0 ? "amber" : "emerald"}
        />
        <StatTile
          href="/dashboard/expenses"
          label="Expenses"
          value={formatCurrency(monthExpenses)}
          sub={monthLabel(month, year)}
          icon={TrendingDown}
          tone="rose"
        />
        <StatTile
          href="/dashboard/society"
          label="Flats"
          value={flatsCount}
          sub={`${occupiedCount} occupied`}
          icon={Building2}
          tone="indigo"
        />
        <StatTile
          href="/dashboard/residents"
          label="Residents"
          value={usersCount}
          sub="Manage users"
          icon={Users}
          tone="slate"
        />
      </div>

      {myFlats.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">My flats</h3>
          <MyFlatsList flats={myFlats} hasWings={mgrSoc?.hasWings ?? true} href="/dashboard/maintenance?tab=mine" />
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <ActionRow
          href="/dashboard/maintenance"
          title="Maintenance dues"
          sub={`Collect and track · ${monthLabel(month, year)}`}
          icon={Receipt}
        />
        <ActionRow
          href="/dashboard/expenses"
          title="Expense analytics"
          sub="All-time, yearly, monthly and by type"
          icon={TrendingDown}
        />
        <ActionRow
          href="/dashboard/bank"
          title="Bank balance"
          sub="Expected balance and tally with the statement"
          icon={Landmark}
        />
        {canReviewUpi && (
          <ActionRow
            href="/dashboard/upi"
            title="Payment settings"
            sub="UPI ID and change approvals"
            icon={Landmark}
          />
        )}
      </div>
    </div>
  );
}

function Greeting({ name, sub }: { name: string; sub: string }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold">Hello, {name.split(" ")[0]} 👋</h2>
      <p className="text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

/** One row per flat the user is linked to, each opening that flat's dues. */
function MyFlatsList({
  flats,
  hasWings,
  href = "/dashboard/maintenance",
}: {
  flats: MyFlat[];
  hasWings: boolean;
  href?: string;
}) {
  if (flats.length === 0) return null;
  const sep = href.includes("?") ? "&" : "?";
  return (
    <div className="space-y-2">
      {flats.length > 1 && (
        <h3 className="text-sm font-semibold">Your flats</h3>
      )}
      {flats.map((f) => (
        <Link
          key={f.id}
          href={flats.length > 1 ? `${href}${sep}flat=${f.id}` : href}
          className="flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:ring-primary/30"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Home className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{flatLabel(f, hasWings)}</span>
            <span className="block text-xs capitalize text-muted-foreground">
              Floor {f.floor.number} · {f.type.toLowerCase()}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className={`block text-sm font-semibold ${f.unpaidTotal > 0 ? "" : "text-emerald-600"}`}>
              {f.unpaidTotal > 0 ? formatCurrency(f.unpaidTotal) : "All paid"}
            </span>
            {f.unpaidCount > 0 && (
              <span className="block text-[11px] text-muted-foreground">
                {f.unpaidCount} due{f.unpaidCount !== 1 ? "s" : ""}
              </span>
            )}
          </span>
        </Link>
      ))}
    </div>
  );
}
