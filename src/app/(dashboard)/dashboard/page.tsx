import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, monthLabel } from "@/lib/utils/month";
import {
  Building2,
  Users,
  Receipt,
  TrendingDown,
  CheckCircle2,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
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
    const flatResidents = await prisma.flatResident.findMany({
      where: { userId, flat: { societyId: societyId! } },
      include: {
        flat: {
          include: { floor: { include: { wing: { select: { name: true } } } } },
        },
      },
    });

    const flatIds = flatResidents.map((fr) => fr.flatId);
    const pendingPayments = await prisma.maintenancePayment.findMany({
      where: { flatId: { in: flatIds }, status: "PENDING" },
      select: { amount: true, month: true, year: true },
    });

    const totalDue = pendingPayments.reduce((s, p) => s + Number(p.amount), 0);

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">
            Hello, {session.user.name.split(" ")[0]}
          </h2>
          <p className="text-sm text-slate-500">{WELCOME[role]}</p>
        </div>

        {/* Flat assignments */}
        {flatResidents.length > 0 && (
          <div className="space-y-2">
            {flatResidents.map((fr) => (
              <Card key={fr.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">
                      Wing {fr.flat.floor.wing.name} · Floor {fr.flat.floor.number} · Flat {fr.flat.number}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{fr.type.toLowerCase()}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Dues card */}
        <Link href="/dashboard/maintenance">
          <Card className={`${totalDue > 0 ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"} cursor-pointer`}>
            <CardContent className="p-4 flex items-center gap-3">
              {totalDue > 0 ? (
                <Clock className="h-5 w-5 text-amber-500 shrink-0" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {totalDue > 0 ? `${formatCurrency(totalDue)} due` : "All dues cleared"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pendingPayments.length} pending payment{pendingPayments.length !== 1 ? "s" : ""}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
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

  const stats = [
    {
      label: "Total Flats",
      value: flatsCount,
      sub: `${occupiedCount} occupied`,
      icon: Building2,
      href: "/dashboard/society",
      color: "text-slate-600",
    },
    {
      label: "Collected",
      value: formatCurrency(totalCollected),
      sub: monthLabel(month, year),
      icon: CheckCircle2,
      href: "/dashboard/maintenance",
      color: "text-green-600",
    },
    {
      label: "Pending Dues",
      value: pendingCount > 0 ? formatCurrency(totalDue) : "All paid",
      sub: `${pendingCount} flat${pendingCount !== 1 ? "s" : ""}`,
      icon: Clock,
      href: "/dashboard/maintenance",
      color: pendingCount > 0 ? "text-amber-600" : "text-green-600",
    },
    {
      label: "Expenses",
      value: formatCurrency(monthExpenses),
      sub: monthLabel(month, year),
      icon: TrendingDown,
      href: "/dashboard/expenses",
      color: "text-red-500",
    },
  ];

  const usersCount = await prisma.user.count({ where: { societyId: societyId! } });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">
          Hello, {session.user.name.split(" ")[0]}
        </h2>
        <p className="text-sm text-slate-500">{WELCOME[role]}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href}>
              <Card className="cursor-pointer hover:shadow-sm transition-shadow h-full">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                      {s.label}
                    </span>
                  </div>
                  <p className="font-bold text-base leading-tight">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/dashboard/residents">
          <Card className="cursor-pointer hover:shadow-sm transition-shadow">
            <CardContent className="p-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-sm font-medium">{usersCount} Users</p>
                <p className="text-xs text-muted-foreground">Manage residents</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/maintenance">
          <Card className="cursor-pointer hover:shadow-sm transition-shadow">
            <CardContent className="p-3 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-sm font-medium">Maintenance</p>
                <p className="text-xs text-muted-foreground">{monthLabel(month, year)}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
