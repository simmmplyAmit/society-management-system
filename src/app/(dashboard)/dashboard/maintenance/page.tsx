import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  getMaintenanceCharges,
  getPayments,
  PAYMENTS_LIMIT,
  type PaymentStatusFilter,
  getResidentPayments,
} from "@/lib/queries/maintenance";
import { SetChargeForm } from "@/components/maintenance/set-charge-form";
import { GeneratePaymentsForm } from "@/components/maintenance/generate-payments-form";
import { DuesScheduler } from "@/components/maintenance/dues-scheduler";
import { ChargesList } from "@/components/maintenance/charges-list";
import { PaymentsTable } from "@/components/maintenance/payments-table";
import { ResidentDues } from "@/components/maintenance/resident-dues";
import { DuesTabs, type DuesTab } from "@/components/maintenance/dues-tabs";
import { PaymentFilters } from "@/components/maintenance/payment-filters";
import { ClaimsList } from "@/components/maintenance/claims-list";
import { countPendingClaims, getPendingClaims, getResidentClaims } from "@/lib/queries/claims";

interface SearchParams {
  tab?: string;
  ym?: string; // YYYY-MM
  flat?: string;
  status?: string;
}

const STATUS_VALUES: PaymentStatusFilter[] = ["unpaid", "overdue", "paid", "all"];

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireRole(["ADMIN", "TREASURER", "SECRETARY", "OWNER", "TENANT"]);
  const { role, societyId, id: userId } = session.user;
  const sp = await searchParams;

  const isManager = role === "ADMIN" || role === "TREASURER";
  const isAdmin = role === "ADMIN";

  const society = await prisma.society.findUnique({
    where: { id: societyId! },
    select: { upiId: true, hasWings: true, name: true },
  });

  // ─── Resident view ───────────────────────────────
  if (role === "OWNER" || role === "TENANT") {
    const [rawPayments, rawClaims] = await Promise.all([
      getResidentPayments(societyId!, userId),
      getResidentClaims(societyId!, userId),
    ]);
    const payments = rawPayments.map((p) => ({ ...p, amount: Number(p.amount) }));
    const claims = rawClaims.map((c) => ({ ...c, amount: Number(c.amount) }));
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">My maintenance</h2>
        <ResidentDues payments={payments} claims={claims} societyUpiId={society?.upiId} societyName={society?.name} hasWings={society?.hasWings ?? true} />
      </div>
    );
  }

  // ─── Manager view ────────────────────────────────
  const tabs: DuesTab[] = ["pending", ...(isManager ? (["verify", "generate"] as const) : []), ...(isAdmin ? (["charges"] as const) : [])];
  const tab: DuesTab = tabs.includes(sp.tab as DuesTab) ? (sp.tab as DuesTab) : "pending";

  const ymMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(sp.ym ?? "");
  const ym = ymMatch ? sp.ym! : "";
  const status = STATUS_VALUES.includes(sp.status as PaymentStatusFilter)
    ? (sp.status as PaymentStatusFilter)
    : "unpaid";
  const flatId = sp.flat ?? "";

  const hasWings = society?.hasWings ?? true;
  const flats = await prisma.flat.findMany({
    where: { societyId: societyId! },
    include: { floor: { include: { wing: { select: { name: true } } } } },
    orderBy: [
      { floor: { wing: { name: "asc" } } },
      { floor: { number: "asc" } },
      { number: "asc" },
    ],
  });
  const flatOptions = flats.flatMap((f) =>
    f.floor?.wing
      ? [{
          id: f.id,
          number: f.number,
          floor: { number: f.floor.number, wing: { name: f.floor.wing.name } },
        }]
      : []
  );

  const rawPayments =
    tab === "pending"
      ? await getPayments(societyId!, {
          month: ymMatch ? Number(ymMatch[2]) : undefined,
          year: ymMatch ? Number(ymMatch[1]) : undefined,
          flatId: flatId || undefined,
          status,
        })
      : [];
  const claimsToVerify = tab === "verify" && isManager ? await getPendingClaims(societyId!) : [];
  const verifyCount = isManager ? await countPendingClaims(societyId!) : 0;
  const rawCharges = tab === "charges" ? await getMaintenanceCharges(societyId!) : [];

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold">Maintenance</h2>
      <DuesTabs tabs={tabs} active={tab} counts={{ verify: verifyCount }} />

      {tab === "pending" && (
        <>
          <PaymentFilters
            flats={flatOptions}
            hasWings={hasWings}
            ym={ym}
            flatId={flatId}
            status={status}
          />
          <PaymentsTable
            payments={rawPayments.map((p) => ({ ...p, amount: Number(p.amount) }))}
            canManage={isManager}
            societyUpiId={society?.upiId}
            hasWings={hasWings}
            limit={PAYMENTS_LIMIT}
          />
        </>
      )}

      {tab === "verify" && isManager && (
        <ClaimsList
          claims={claimsToVerify.map((c) => ({
            ...c,
            amount: Number(c.amount),
            payments: c.payments.map((p) => ({ ...p, amount: Number(p.amount) })),
          }))}
          hasWings={hasWings}
        />
      )}

      {tab === "generate" && isManager && (
        <>
          <GeneratePaymentsForm />
          <DuesScheduler flats={flatOptions} hasWings={hasWings} />
        </>
      )}

      {tab === "charges" && isAdmin && (
        <>
          <SetChargeForm flats={flatOptions} hasWings={hasWings} />
          <ChargesList
            charges={rawCharges.map((c) => ({ ...c, amount: Number(c.amount) }))}
            isAdmin={isAdmin}
            hasWings={hasWings}
          />
        </>
      )}
    </div>
  );
}
