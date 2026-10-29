"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { submitPaymentClaim } from "@/actions/claims";
import { useErrorText } from "@/components/i18n/use-error-text";
import { fileProblemKey, uploadAttachments } from "@/lib/client/upload-documents";
import { MAX_PROOFS_PER_CLAIM } from "@/lib/utils/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils/month";

/** After paying by UPI, the resident reports the UTR for the selected dues. */
export function ReportPaymentForm({
  paymentIds,
  total,
}: {
  paymentIds: string[];
  total: number;
}) {
  const t = useTranslations("dues.report");
  const tf = useTranslations("files");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [proofs, setProofs] = useState<File[]>([]);
  const today = new Date().toISOString().split("T")[0];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    for (const id of paymentIds) fd.append("paymentId", id);
    startTransition(async () => {
      const r = await submitPaymentClaim(fd);
      if ("error" in r && r.error) return void toast.error(errorText(r.error));
      toast.success(t("sent"));
      setOpen(false);
      // The report is saved; the proof is a bonus, so a failed upload never undoes it
      const claimId = (r as { claimId?: string }).claimId;
      if (proofs.length > 0 && claimId) {
        const up = await uploadAttachments(proofs, { claimId }, { category: "OTHER", titlePrefix: "Payment proof" });
        if (up.uploaded) toast.success(t("proofsAttached", { count: up.uploaded }));
        up.errors.forEach((m) => toast.error(t("proofFailed", { message: m })));
      }
      setProofs([]);
      router.refresh();
    });
  }

  const disabled = paymentIds.length === 0;

  return (
    <div className="rounded-xl bg-card ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="flex w-full items-center gap-3 p-4 text-left disabled:opacity-50"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{t("toggle")}</span>
          <span className="block text-xs text-muted-foreground">{t("toggleHint")}</span>
        </span>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <form onSubmit={submit} className="space-y-3 border-t border-border p-4">
          <p className="text-xs text-muted-foreground">
            {t.rich("intro", {
              count: paymentIds.length,
              amount: formatCurrency(total),
              b: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
            })}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="amount">{t("amount")}</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              inputMode="decimal"
              min="1"
              step="0.01"
              defaultValue={total > 0 ? total : undefined}
              key={total}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="utrNumber">{t("utr")}</Label>
            <p className="text-[11px] text-muted-foreground">{t("utrHint")}</p>
            <Input
              id="utrNumber"
              name="utrNumber"
              placeholder={t("utrPlaceholder")}
              autoComplete="off"
              inputMode="text"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="paidOn">{t("paidOn")}</Label>
            <Input id="paidOn" name="paidOn" type="date" defaultValue={today} max={today} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proof">{t("proof")}</Label>
            <p className="text-[11px] text-muted-foreground">{t("proofHint", { max: MAX_PROOFS_PER_CLAIM })}</p>
            <input
              id="proof"
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                const bad = picked.find((f) => fileProblemKey(f));
                if (bad) toast.error(tf(fileProblemKey(bad)!, { name: bad.name }));
                setProofs(picked.filter((f) => !fileProblemKey(f)).slice(0, MAX_PROOFS_PER_CLAIM));
              }}
              className="block w-full rounded-lg border border-input bg-white text-sm file:mr-3 file:h-10 file:border-0 file:bg-primary/10 file:px-3 file:text-sm file:font-medium file:text-primary"
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? tc("sending") : t("submit")}
          </Button>
        </form>
      )}
    </div>
  );
}
