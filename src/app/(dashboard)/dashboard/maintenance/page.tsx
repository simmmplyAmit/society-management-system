import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  getMaintenanceCharges,
  getMonthlyPayments,
  getResidentPayments,
} from "@/actions/maintenance";
import { SetChargeForm } from "@/components/maintenance/set-charge-form";
import { GeneratePaymentsForm } from "@/components/maintenance/generate-payments-form";
import { DuesScheduler } from "@/components/maintenance/dues-scheduler";
import { ChargesList } from "@/components/maintenance/charges-list";
import { PaymentsTable } from "@/components/maintenance/payments-table";
import { ResidentDues } from "@/components/maintenance/resident-dues";
import { MonthSelector } from "@/components/maintenance/month-selector";
import { Separator } from "@/components/ui/separator";

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
    select: { upiId: true, hasWings: true },
  });

  // ─── Resident view ───────────────────────────────
  if (role === "OWNER" || role === "TENANT") {
    const rawPayments = await getResidentPayments(societyId!, userId);
    const payments = rawPayments.map((p) => ({ ...p, amount: Number(p.amount) }));
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">My Maintenance</h2>
        <ResidentDues payments={payments} societyUpiId={society?.upiId} hasWings={society?.hasWings ?? true} />
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

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">Maintenance</h2>

      {/* Month navigator + generate */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <MonthSelector month={month} year={year} />
        </div>
        {isManager && <GeneratePaymentsForm />}
      </div>

      {/* Bulk scheduler — manager only */}
      {isManager && (
        <DuesScheduler
          flats={flats.flatMap((f) =>
            f.floor?.wing ? [{
              id: f.id,
              number: f.number,
              floor: { number: f.floor.number, wing: { name: f.floor.wing.name } },
            }] : []
          )}
          hasWings={society?.hasWings ?? true}
        />
      )}

      {/* Payments overview */}
      <PaymentsTable
        payments={rawPayments.map((p) => ({ ...p, amount: Number(p.amount) }))}
        canManage={isManager}
        societyUpiId={society?.upiId}
        hasWings={society?.hasWings ?? true}
      />

      {isAdmin && (
        <>
          <Separator />

          {/* Charges management */}
          <div>
            <h3 className="text-base font-semibold mb-3">Maintenance Charges</h3>
            <SetChargeForm
              flats={flats.flatMap((f) =>
                f.floor?.wing ? [{
                  id: f.id,
                  number: f.number,
                  floor: { number: f.floor.number, wing: { name: f.floor.wing.name } },
                }] : []
              )}
              hasWings={society?.hasWings ?? true}
            />
            <div className="mt-3">
              <ChargesList
                charges={rawCharges.map((c) => ({ ...c, amount: Number(c.amount) }))}
                isAdmin={isAdmin}
                hasWings={society?.hasWings ?? true}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
