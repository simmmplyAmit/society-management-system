import { requireRole } from "@/lib/session";
import { getBankAccounts, getBankBalance, getCashInHand, getBalanceChecks } from "@/lib/queries/bank";
import { formatCurrency, formatDate } from "@/lib/utils/month";
import { AddBankAccountForm, BalanceCheckForm, MakePrimaryButton } from "@/components/bank/bank-forms";
import { ToolSection } from "@/components/ui/tool-section";
import { Landmark, Plus, Scale } from "lucide-react";
import { PageTitle } from "@/components/ui/page-title";

const card = "rounded-xl bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]";

function Row({ label, value, sign, bold }: { label: string; value: number; sign?: "+" | "-"; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 text-sm ${bold ? "font-semibold" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span>{sign}{formatCurrency(value)}</span>
    </div>
  );
}

export default async function BankPage() {
  const session = await requireRole(["ADMIN", "SECRETARY", "TREASURER"]);
  const societyId = session.user.societyId!;
  const canEdit = session.user.role === "ADMIN" || session.user.role === "TREASURER";
  const today = new Date();

  const accounts = await getBankAccounts(societyId);
  const [balances, cash, checks] = await Promise.all([
    Promise.all(accounts.map((a) => getBankBalance(societyId, a, today))),
    getCashInHand(societyId),
    getBalanceChecks(societyId),
  ]);

  return (
    <div className="space-y-5">
      <PageTitle emoji="🏦">Bank balance</PageTitle>
      <p className="-mt-3 text-sm text-muted-foreground">
        What the bank account should hold according to the app, so you can tally it against the bank statement.
      </p>

      {accounts.length === 0 && (
        <div className={card}>
          <p className="mb-1 text-sm font-semibold">Add the society&apos;s bank account</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Enter the balance on your statement at a starting date. From then on the app adds every payment received and
            deducts every expense paid by bank.
          </p>
          {canEdit ? <AddBankAccountForm first /> : <p className="text-sm text-muted-foreground">An admin or treasurer needs to add the account.</p>}
        </div>
      )}

      {accounts.map((a, i) => {
        const b = balances[i];
        const lastCheck = checks.find((c) => c.accountName === a.name);
        return (
          <div key={a.id} className={`${card} space-y-3`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Landmark className="size-4 text-primary" /> <span className="truncate">{a.name}</span>
                  {a.isPrimary && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Primary</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[a.bankName, a.last4 ? `•••• ${a.last4}` : null].filter(Boolean).join(" · ") || "Bank account"}
                  {" · counted from "}{formatDate(a.openingDate)}
                </p>
              </div>
              {canEdit && !a.isPrimary && accounts.length > 1 && <MakePrimaryButton id={a.id} />}
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">Expected balance today</p>
              <p className="text-2xl font-semibold">{formatCurrency(b.expected)}</p>
            </div>

            <div className="space-y-1.5 border-t border-border pt-3">
              <Row label="Opening balance" value={b.openingBalance} />
              <Row label="Members’ payments (UPI, cheque, transfer)" value={b.memberDeposits} sign="+" />
              <Row label="Cash deposited" value={b.cashDeposits} sign="+" />
              <Row label="Other income" value={b.otherIncome} sign="+" />
              <Row label="Expenses paid from the bank" value={b.expensesPaid} sign="-" />
              <div className="border-t border-border pt-1.5">
                <Row label="Expected balance" value={b.expected} bold />
              </div>
            </div>

            {b.unconfirmedCashDeposits > 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-600/20">
                {b.unconfirmedCashDeposits} cash deposit{b.unconfirmedCashDeposits !== 1 ? "s" : ""} not yet confirmed by a second person.
                They are counted here; check they appear on the statement.
              </p>
            )}

            {lastCheck && (
              <p className={`text-xs ${lastCheck.difference === 0 ? "text-emerald-700" : "text-destructive"}`}>
                Last check ({formatDate(lastCheck.asOf)}): {lastCheck.difference === 0 ? "tallied" : `difference ${formatCurrency(lastCheck.difference)}`}
              </p>
            )}

            {canEdit && (
              <ToolSection title="Tally with bank statement" description="Enter the balance shown on your statement" icon={Scale}>
                <BalanceCheckForm accountId={a.id} />
              </ToolSection>
            )}
          </div>
        );
      })}

      <div className={card}>
        <p className="text-xs font-medium text-muted-foreground">Cash in hand</p>
        <p className="text-xl font-semibold">{formatCurrency(cash.total)}</p>
        <p className="text-xs text-muted-foreground">
          {formatCurrency(cash.receipts)} collected and not yet banked
          {cash.cashIncome > 0 ? ` + ${formatCurrency(cash.cashIncome)} cash income` : ""}
          {cash.cashExpenses > 0 ? ` − ${formatCurrency(cash.cashExpenses)} cash expenses` : ""}.
        </p>
      </div>

      {checks.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Recent tally checks</h3>
          <div className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border">
            {checks.map((c) => (
              <div key={c.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{c.accountName} · {formatDate(c.asOf)}</span>
                  <span className={c.difference === 0 ? "font-semibold text-emerald-700" : "font-semibold text-destructive"}>
                    {c.difference === 0 ? "Tallied" : `${c.difference > 0 ? "+" : "−"}${formatCurrency(Math.abs(c.difference))}`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Statement {formatCurrency(c.statementBalance)} · App {formatCurrency(c.expectedBalance)} · {c.recordedBy}
                  {c.note ? ` · ${c.note}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {canEdit && accounts.length > 0 && (
        <ToolSection title="Add another account" description="For example a fixed deposit or sinking-fund account" icon={Plus}>
          <AddBankAccountForm />
        </ToolSection>
      )}
    </div>
  );
}
