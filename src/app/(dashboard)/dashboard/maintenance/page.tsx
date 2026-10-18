import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  getMaintenanceCharges,
  getMonthlyPayments,
  getResidentPayments,
} from "@/lib/queries/maintenance";
import { SetChargeForm } from "@/components/maintenance/set-charge-form";
import { GeneratePaymentsForm } from "@/components/maintenance/generate-payments-form";
import { DuesScheduler } from "@/components/maintenance/dues-scheduler";
import { ChargesList } from "@/components/maintenance/charges-list";
import { PaymentsTable } from "@/components/maintenance/payments-table";
import { ResidentDues } from "@/components/maintenance/resident-dues";
import { MonthSelector } from "@/components/maintenance/month-selector";
import { ToolSection } from "@/components/ui/tool-section";
import { CalendarPlus, IndianRupee } from "lucide-react";

interface SearchParams {
  month?: string;
  year?: string;
}

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireRole(["ADMIN", "TREASURER", "SECRETARY", "OWNER", "TENANT"]);
  const { role, societyId, id: userId } = session.user;
  const sp = await searchParams;

  const now = new Date();
  const month = parseInt(sp.month ?? String(now.getMonth() + 1), 10);
  const year = parseInt(sp.year ?? String(now.getFullYear()), 10);

  const isManager = role === "ADMIN" || role === "TREASURER";
  const isAdmin = role === "ADMIN";

  const society = await prisma.society.findUnique({
    where: { id: societyId! },
    select: { upiId: true, hasWings: true, name: true },
  });

  // ─── Resident view ───────────────────────────────
  if (role === "OWNER" || role === "TENANT") {
    const rawPayments = await getResidentPayments(societyId!, userId);
    const payments = rawPayments.map((p) => ({ ...p, amount: Number(p.amount) }));
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">My maintenance</h2>
        <ResidentDues payments={payments} societyUpiId={society?.upiId} societyName={society?.name} hasWings={society?.hasWings ?? true} />
      </div>
    );
  }

  // ─── Manager view ────────────────────────────────
  const [rawCharges, rawPayments, flats] = await Promise.all([
    getMaintenanceCharges(societyId!),
    getMonthlyPayments(societyId!, month, year),
    isManager
      ? prisma.flat.findMany({
          where: { societyId: societyId! },
          include: {
            floor: { include: { wing: { select: { name: true } } } },
          },
          orderBy: [
            { floor: { wing: { name: "asc" } } },
            { floor: { number: "asc" } },
            { number: "asc" },
          ],
        })
      : Promise.resolve([]),
  ]);

  const flatOptions = flats.flatMap((f) =>
    f.floor?.wing
      ? [{
          id: f.id,
          number: f.number,
          floor: { number: f.floor.number, wing: { name: f.floor.wing.name } },
        }]
      : []
  );
  const hasWings = society?.hasWings ?? true;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Maintenance</h2>
        <MonthSelector month={month} year={year} />
      </div>

      <PaymentsTable
        payments={rawPayments.map((p) => ({ ...p, amount: Number(p.amount) }))}
        canManage={isManager}
        societyUpiId={society?.upiId}
        hasWings={hasWings}
      />

      {isManager && (
        <ToolSection
          title="Generate dues"
          description="Create this month's records, or schedule a date range"
          icon={CalendarPlus}
        >
          <GeneratePaymentsForm />
          <DuesScheduler flats={flatOptions} hasWings={hasWings} />
        </ToolSection>
      )}

      {isAdmin && (
        <ToolSection
          title="Maintenance charges"
          description={`${rawCharges.length} active · set the amount per flat`}
          icon={IndianRupee}
        >
          <SetChargeForm flats={flatOptions} hasWings={hasWings} />
          <ChargesList
            charges={rawCharges.map((c) => ({ ...c, amount: Number(c.amount) }))}
            isAdmin={isAdmin}
            hasWings={hasWings}
          />
        </ToolSection>
      )}
    </div>
  );
}
