import Link from "next/link";
import { Building2, CheckCircle2, FileSpreadsheet, History, Receipt, TrendingDown, Users } from "lucide-react";
import { requireRole } from "@/lib/session";
import { getSociety } from "@/lib/queries/society";
import { getImportProgress } from "@/lib/queries/import";
import { SocietySettingsForm } from "@/components/society/society-settings-form";
import { ImportPanel } from "@/components/import/import-panel";
import type { ImportKindKey } from "@/lib/import/kinds";
import { formatDate } from "@/lib/utils/month";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

const KIND_LABEL = { FLATS: "Flats", RESIDENTS: "Residents", DUES: "Past dues", EXPENSES: "Expenses" } as const;

interface Step {
  kind: ImportKindKey;
  title: string;
  description: string;
  icon: React.ElementType;
  done: string | null;
  adminOnly: boolean;
}

export default async function ImportPage() {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;
  const isAdmin = session.user.role === "ADMIN";
  const [society, progress] = await Promise.all([getSociety(societyId), getImportProgress(societyId)]);
  if (!society) return <p className="text-sm text-muted-foreground">Society not found.</p>;

  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const steps: Step[] = [
    {
      kind: "flats",
      title: "Flats",
      description: society.hasWings
        ? "Wings, floors and flats, with flat type, area and monthly maintenance. Wings and floors are created for you."
        : "Floors and flats, with flat type, area and monthly maintenance. Floors are created for you.",
      icon: Building2,
      done: progress.flats ? `${plural(progress.flats, "flat")} in the society` : null,
      adminOnly: true,
    },
    {
      kind: "residents",
      title: "Residents",
      description: "Owners and tenants with their flats, and who is on the committee. One row per person per flat.",
      icon: Users,
      done: progress.members > 1 ? `${plural(progress.members, "member")}` : null,
      adminOnly: true,
    },
    {
      kind: "dues",
      title: "Past maintenance and arrears",
      description: "What each flat was billed and paid in earlier months, so unpaid balances carry over. Import flats first.",
      icon: Receipt,
      done: progress.dues ? `${plural(progress.dues, "due")} on record` : null,
      adminOnly: false,
    },
    {
      kind: "expenses",
      title: "Past expenses",
      description: "Bills the society has paid, for this year's accounts and expense reports.",
      icon: TrendingDown,
      done: progress.expenses ? `${plural(progress.expenses, "expense")} on record` : null,
      adminOnly: false,
    },
  ];
  const visible = steps.filter((s) => isAdmin || !s.adminOnly);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="size-5 text-primary" />
          <h2 className="text-2xl font-semibold">Import from Excel</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Bring your register or spreadsheet into the app, one sheet at a time. Every file is checked first, and nothing is
          saved until you confirm. Importing the same file again skips what is already there.
        </p>
      </div>

      <ol className="space-y-3">
        {isAdmin && (
          <StepCard
            n={1}
            title="Society details"
            description={`Name and address, and whether the society has wings (now: ${society.hasWings ? "has wings" : "no wings"}). Set this before importing flats.`}
            icon={Building2}
            done={null}
          >
            <SocietySettingsForm society={society} />
          </StepCard>
        )}
        {visible.map((s, i) => (
          <StepCard key={s.kind} n={i + (isAdmin ? 2 : 1)} title={s.title} description={s.description} icon={s.icon} done={s.done}>
            <ImportPanel kind={s.kind} hasWings={society.hasWings} brand={SITE.brand} />
          </StepCard>
        ))}
      </ol>

      {!isAdmin && (
        <p className="text-xs text-muted-foreground">Flats and residents are imported by a society admin.</p>
      )}

      {progress.batches.length > 0 && (
        <section className="rounded-xl bg-card p-4 ring-1 ring-border">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <History className="size-4" /> Recent imports
          </h3>
          <ul className="mt-3 divide-y text-xs">
            {progress.batches.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-2">
                <span className="font-medium">
                  {KIND_LABEL[b.kind]}
                  {b.fileName && <span className="font-normal text-muted-foreground"> · {b.fileName}</span>}
                </span>
                <span className="text-muted-foreground">
                  {b.created} new{b.updated ? `, ${b.updated} updated` : ""} · {b.createdBy.name} · {formatDate(b.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        Prefer to add things one by one? Use{" "}
        <Link href="/dashboard/society" className="text-primary underline underline-offset-2">Society</Link>,{" "}
        <Link href="/dashboard/residents" className="text-primary underline underline-offset-2">Residents</Link> and{" "}
        <Link href="/dashboard/expenses" className="text-primary underline underline-offset-2">Expenses</Link>.
      </p>
    </div>
  );
}

function StepCard({
  n,
  title,
  description,
  icon: Icon,
  done,
  children,
}: {
  n: number;
  title: string;
  description: string;
  icon: React.ElementType;
  done: string | null;
  children: React.ReactNode;
}) {
  return (
    <li>
      <details className="group rounded-xl bg-card ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <summary className="flex cursor-pointer list-none items-start gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
              done ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15" : "bg-primary/10 text-primary"
            )}
          >
            {done ? <CheckCircle2 className="size-[18px]" /> : n}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <Icon className="size-4 text-muted-foreground" /> {title}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
            {done && <span className="mt-1 block text-xs font-medium text-emerald-700">{done}</span>}
          </span>
        </summary>
        <div className="border-t border-border p-4 [&_[data-slot=card]]:bg-transparent [&_[data-slot=card]]:shadow-none [&_[data-slot=card]]:ring-0">
          {children}
        </div>
      </details>
    </li>
  );
}
