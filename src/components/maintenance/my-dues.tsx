import { prisma } from "@/lib/prisma";
import { getResidentPayments } from "@/lib/queries/maintenance";
import { getCreditActivity, getResidentClaims } from "@/lib/queries/claims";
import { getCreditBalance } from "@/lib/ledger";
import { getMyFlats } from "@/lib/queries/flats";
import { isRecentUpiChange } from "@/lib/queries/upi";
import { ResidentDues } from "./resident-dues";

/** The signed-in user's own dues across every flat they are linked to. */
export async function MyDues({
  societyId,
  userId,
  initialFlatId,
}: {
  societyId: string;
  userId: string;
  initialFlatId?: string;
}) {
  const [society, rawPayments, rawClaims, flats, creditBalance, creditActivity] = await Promise.all([
    prisma.society.findUnique({
      where: { id: societyId },
      select: { upiId: true, upiChangedAt: true, hasWings: true, name: true },
    }),
    getResidentPayments(societyId, userId),
    getResidentClaims(societyId, userId),
    getMyFlats(societyId, userId),
    getCreditBalance(societyId, userId),
    getCreditActivity(societyId, userId),
  ]);

  return (
    <div className="space-y-4">
      {isRecentUpiChange(society?.upiChangedAt ?? null, new Date()) && (
        <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-600/20">
          <span className="font-semibold">The society&apos;s UPI ID was changed recently.</span> If you did not hear
          about this from your committee, check with them before paying.
        </div>
      )}
      <ResidentDues
        payments={rawPayments.map((p) => ({ ...p, amount: Number(p.amount), amountPaid: Number(p.amountPaid) }))}
        creditBalance={creditBalance}
        creditActivity={creditActivity.map((m) => ({ ...m, amount: Number(m.amount) }))}
        flats={flats}
        initialFlatId={initialFlatId}
        claims={rawClaims.map((c) => ({ ...c, amount: Number(c.amount) }))}
        societyUpiId={society?.upiId}
        societyName={society?.name}
        hasWings={society?.hasWings ?? true}
      />
    </div>
  );
}
