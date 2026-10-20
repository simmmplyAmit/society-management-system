import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  getMaintenanceCharges,
  getPayments,
  PAYMENTS_LIMIT,
  type PaymentStatusFilter,
} from "@/lib/queries/maintenance";
import { SetChargeForm } from "@/components/maintenance/set-charge-form";
import { GeneratePaymentsForm } from "@/components/maintenance/generate-payments-form";
import { DuesScheduler } from "@/components/maintenance/dues-scheduler";
import { ChargesList } from "@/components/maintenance/charges-list";
import { PaymentsTable } from "@/components/maintenance/payments-table";
import { DuesTabs, type DuesTab } from "@/components/maintenance/dues-tabs";
import { PaymentFilters } from "@/components/maintenance/payment-filters";
import { MyDues } from "@/components/maintenance/my-dues";
import { getFlatDetails, getMemberOptions, getMyFlats } from "@/lib/queries/flats";
import { getSpecialCharges } from "@/lib/queries/special-charges";
import { SpecialChargeForm } from "@/components/maintenance/special-charge-form";
import { SpecialChargesList } from "@/components/maintenance/special-charges-list";
import { RecordDepositForm, type MemberOption } from "@/components/maintenance/record-deposit-form";
import { ToolSection } from "@/components/ui/tool-section";
import { Plus, Wallet } from "lucide-react";
import { ClaimsList } from "@/components/maintenance/claims-list";
import { countPendingClaims, getPendingClaims } from "@/lib/queries/claims";

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
    select: { upiId: true, hasWings: true },
  });

  // ─── Resident view ───────────────────────────────
  if (role === "OWNER" || role === "TENANT") {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">My maintenance</h2>
        <MyDues societyId={societyId!} userId={userId} initialFlatId={sp.flat} />
      </div>
    );
  }

  // ─── Manager view ────────────────────────────────
  // Committee members can own flats too: they get a "My dues" tab for their own flats
  const myFlats = await getMyFlats(societyId!, userId);
  const myDueCount = myFlats.reduce((n, f) => n + f.unpaidCount, 0);
  const tabs: DuesTab[] = ["pending", ...(isManager ? (["verify"] as const) : []), ...(myFlats.length > 0 ? (["mine"] as const) : []), ...(isManager ? (["generate"] as const) : []), ...(isAdmin ? (["charges"] as const) : []), ...(isManager ? (["other"] as const) : [])];
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
  // Members who can receive credit: anyone linked to a flat, listed with their flats
  const members: MemberOption[] = tab === "pending" && isManager ? await getMemberOptions(societyId!) : [];
  const specialCharges = tab === "other" && isManager ? await getSpecialCharges(societyId!) : [];
  const flatDetails = tab === "other" && isAdmin ? await getFlatDetails(societyId!) : [];
  const rawCharges = tab === "charges" ? await getMaintenanceCharges(societyId!) : [];

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold">Maintenance</h2>
      <DuesTabs tabs={tabs} active={tab} counts={{ verify: verifyCount, mine: myDueCount }} />

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
            payments={rawPayments.map((p) => ({ ...p, amount: Number(p.amount), amountPaid: Number(p.amountPaid) }))}
            canManage={isManager}
            societyUpiId={society?.upiId}
            hasWings={hasWings}
            limit={PAYMENTS_LIMIT}
          />
          {isManager && members.length > 0 && (
            <ToolSection
              title="Record a payment"
              description="Cash, cheque or UPI received outside the app, in any amount"
              icon={Wallet}
            >
              <RecordDepositForm members={members} />
            </ToolSection>
          )}
        </>
      )}

      {tab === "mine" && myFlats.length > 0 && (
        <MyDues societyId={societyId!} userId={userId} initialFlatId={sp.flat} />
      )}

      {tab === "verify" && isManager && (
        <ClaimsList
          claims={claimsToVerify.map((c) => ({
            ...c,
            amount: Number(c.amount),
            payments: c.payments.map((p) => ({ ...p, amount: Number(p.amount), amountPaid: Number(p.amountPaid) })),
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

      {tab === "other" && isManager && (
        <>
          {isAdmin && (
            <ToolSection
              title="New charge"
              description="Sinking fund, water, festival, repairs… one-time or recurring"
              icon={Plus}
            >
              <SpecialChargeForm flats={flatDetails} />
            </ToolSection>
          )}
          <SpecialChargesList
            charges={specialCharges.map((c) => ({
              ...c,
              rate: Number(c.rate),
              minArea: c.minArea == null ? null : Number(c.minArea),
              maxArea: c.maxArea == null ? null : Number(c.maxArea),
            }))}
            canManage={isAdmin}
          />
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
