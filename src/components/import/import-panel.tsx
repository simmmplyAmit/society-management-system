"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Copy, Download, FileUp, Info, XCircle } from "lucide-react";
import { applyImport, previewImport } from "@/actions/import";
import { COLUMNS, MAX_IMPORT_CHARS, templateCsv, type ImportKindKey } from "@/lib/import/kinds";
import type { ImportAction, ImportResult } from "@/lib/queries/import";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SHOWN_ROWS = 100;

const ACTION_STYLE: Record<ImportAction, { label: string; variant: "success" | "info" | "secondary" }> = {
  create: { label: "New", variant: "success" },
  update: { label: "Update", variant: "info" },
  skip: { label: "Already there", variant: "secondary" },
};

const DONE_TEXT: Record<ImportKindKey, string> = {
  flats: "Flats imported",
  residents: "Residents imported",
  dues: "Past dues imported",
  expenses: "Expenses imported",
};

export function ImportPanel({ kind, hasWings, brand }: { kind: ImportKindKey; hasWings: boolean; brand: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [checkedText, setCheckedText] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"check" | "import" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const columns = COLUMNS[kind].filter((c) => hasWings || c.key !== "wing");

  function downloadTemplate() {
    const blob = new Blob([templateCsv(kind, hasWings)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kind}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (/\.(xlsx|xls|ods|numbers)$/i.test(file.name)) {
      toast.error("Save the sheet as CSV first (File → Save as → CSV), or copy the cells and paste them below");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setText(await file.text());
    setFileName(file.name);
    setResult(null);
  }

  function formData() {
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("text", text);
    if (fileName) fd.set("fileName", fileName);
    return fd;
  }

  function tooLarge() {
    if (new Blob([text]).size <= MAX_IMPORT_CHARS) return false;
    toast.error("This file is too large for one import. Split it into smaller files (for example one per year)");
    return true;
  }

  function check() {
    if (tooLarge()) return;
    setBusy("check");
    startTransition(async () => {
      const r = await previewImport(formData());
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setResult(r.result);
      setCheckedText(text);
    });
  }

  function runImport() {
    if (tooLarge()) return;
    setBusy("import");
    startTransition(async () => {
      const r = await applyImport(formData());
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      if (!r.result.applied) {
        setResult(r.result);
        toast.error("Fix the rows marked in red, then check again");
        return;
      }
      const { create, update } = r.result.counts;
      toast.success(`${DONE_TEXT[kind]}: ${create} new${update ? `, ${update} updated` : ""}`);
      setResult(null);
      setText("");
      setFileName(null);
      setCheckedText(null);
      if (fileRef.current) fileRef.current.value = "";
      if (kind === "residents" && create > 0) setShowInvite(true);
      router.refresh();
    });
  }

  const stale = result !== null && checkedText !== text;
  const canImport = result !== null && !stale && result.errors.length === 0 && result.counts.create + result.counts.update > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={downloadTemplate}>
          <Download /> Download template
        </Button>
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
          <FileUp /> Choose CSV file
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>

      <details className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
        <summary className="cursor-pointer font-medium">Columns ({columns.filter((c) => c.required === true || (c.required === "wings" && hasWings)).length} required)</summary>
        <ul className="mt-2 space-y-1.5">
          {columns.map((c) => (
            <li key={c.key}>
              <span className="font-medium">{c.label}</span>
              {(c.required === true || (c.required === "wings" && hasWings)) && <span className="text-rose-600"> *</span>}
              <span className="text-muted-foreground"> · {c.help}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-muted-foreground">
          Column names don&apos;t have to match exactly (for example &quot;Flat No.&quot; works). Extra columns are ignored.
        </p>
      </details>

      <div className="space-y-1.5">
        <label htmlFor={`import-${kind}`} className="text-xs font-medium text-muted-foreground">
          {fileName ? `From ${fileName}. You can edit the rows here.` : "Or copy the rows from Excel or Google Sheets, header row included, and paste them here"}
        </label>
        <textarea
          id={`import-${kind}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          spellCheck={false}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder={columns.map((c) => c.label).join("\t")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant={canImport ? "outline" : "default"} onClick={check} disabled={isPending || text.trim() === ""}>
          {isPending && busy === "check" ? "Checking…" : "Check rows"}
        </Button>
        {canImport && (
          <Button type="button" onClick={runImport} disabled={isPending}>
            {isPending && busy === "import" ? "Importing…" : `Import ${result.counts.create + result.counts.update} row${result.counts.create + result.counts.update === 1 ? "" : "s"}`}
          </Button>
        )}
        {stale && <span className="text-xs text-amber-700">The rows changed. Check them again before importing.</span>}
      </div>

      {result && <ResultView result={result} />}
      {showInvite && <InviteMessage brand={brand} onClose={() => setShowInvite(false)} />}
    </div>
  );
}

function IssueList({ tone, items }: { tone: "error" | "warning"; items: { line: number; message: string }[] }) {
  if (!items.length) return null;
  const Icon = tone === "error" ? XCircle : AlertTriangle;
  return (
    <div className={cn("rounded-lg p-3 text-xs ring-1", tone === "error" ? "bg-rose-50 text-rose-800 ring-rose-600/15" : "bg-amber-50 text-amber-900 ring-amber-600/20")}>
      <p className="mb-1.5 flex items-center gap-1.5 font-semibold">
        <Icon className="size-4" />
        {tone === "error"
          ? `${items.length} row${items.length > 1 ? "s need" : " needs"} fixing before anything is imported`
          : `${items.length} warning${items.length > 1 ? "s" : ""}`}
      </p>
      <ul className="max-h-48 space-y-1 overflow-y-auto">
        {items.map((i, n) => (
          <li key={n}>
            <span className="font-mono">Line {i.line}</span>: {i.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultView({ result }: { result: ImportResult }) {
  const { counts } = result;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="success">{counts.create} new</Badge>
        {counts.update > 0 && <Badge variant="info">{counts.update} to update</Badge>}
        {counts.skip > 0 && <Badge variant="secondary">{counts.skip} already there</Badge>}
        {result.errors.length > 0 && <Badge variant="danger">{result.errors.length} to fix</Badge>}
      </div>

      <IssueList tone="error" items={result.errors} />
      <IssueList tone="warning" items={result.warnings} />

      {result.notes.length > 0 && result.errors.length === 0 && (
        <ul className="space-y-1.5 rounded-lg bg-sky-50 p-3 text-xs text-sky-900 ring-1 ring-sky-600/20">
          {result.notes.map((n) => (
            <li key={n} className="flex gap-1.5">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {n}
            </li>
          ))}
        </ul>
      )}

      {result.items.length > 0 && (
        <div className="overflow-hidden rounded-lg ring-1 ring-border">
          <ul className="max-h-80 divide-y overflow-y-auto text-xs">
            {result.items.slice(0, SHOWN_ROWS).map((i) => (
              <li key={i.line} className="flex items-start gap-2 px-3 py-2">
                <span className="w-10 shrink-0 font-mono text-muted-foreground">{i.line}</span>
                <span className="min-w-0 flex-1 break-words">{i.text}</span>
                <Badge variant={ACTION_STYLE[i.action].variant}>{ACTION_STYLE[i.action].label}</Badge>
              </li>
            ))}
          </ul>
          {result.items.length > SHOWN_ROWS && (
            <p className="border-t bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              and {result.items.length - SHOWN_ROWS} more rows
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function InviteMessage({ brand, onClose }: { brand: string; onClose: () => void }) {
  const link = `${window.location.origin}/forgot-password`;
  const message = `Our society now manages maintenance, payments and notices on ${brand}. To sign in, open ${link}, enter the email the committee has for you and set your password. You'll then confirm your email and mobile with a one-time code.`;
  return (
    <div className="space-y-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900 ring-1 ring-emerald-600/15">
      <p className="flex items-center gap-1.5 font-semibold">
        <CheckCircle2 className="size-4" /> Let residents know
      </p>
      <p>Share this message on your society&apos;s WhatsApp group:</p>
      <p className="rounded-md bg-white/70 p-2">{message}</p>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => navigator.clipboard.writeText(message).then(() => toast.success("Message copied"), () => toast.error("Couldn't copy; select the text instead"))}
        >
          <Copy /> Copy message
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
