// Server-only import wizard logic. Deliberately NOT a "use server" file: callers pass the
// societyId and userId from the authenticated session (src/actions/import.ts).
//
// Every import is checked first (apply = false) and shown to the user row by row. Applying
// re-checks the same text and writes everything in one transaction, or nothing when any row
// still has an error. Re-running the same file is safe: existing records are skipped.
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { ImportKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseTable } from "@/lib/import/csv";
import {
  chargeKeyFor,
  MAX_IMPORT_CHARS,
  validateTable,
  type DueRow,
  type ExpenseRow,
  type FlatRef,
  type FlatRow,
  type ImportKindKey,
  type ResidentRow,
  type RowIssue,
} from "@/lib/import/kinds";
import { toIdx, periodsOverlap } from "@/lib/utils/maintenance";
import { MONTHS } from "@/lib/utils/month";

export type ImportAction = "create" | "update" | "skip";

export interface PreviewItem {
  line: number;
  action: ImportAction;
  text: string;
}

export interface ImportResult {
  kind: ImportKindKey;
  rowCount: number;
  errors: RowIssue[];
  warnings: RowIssue[];
  counts: Record<ImportAction, number>;
  items: PreviewItem[];
  /** Extra effects, e.g. "2 wings and 6 floors will be created". */
  notes: string[];
  applied: boolean;
}

interface RunOptions {
  kind: ImportKindKey;
  societyId: string;
  userId: string;
  text: string;
  fileName?: string | null;
  apply: boolean;
  now?: Date;
}

type Tx = Prisma.TransactionClient;

const DEFAULT_WING = "_default_";
const KIND_ENUM: Record<ImportKindKey, ImportKind> = { flats: "FLATS", residents: "RESIDENTS", dues: "DUES", expenses: "EXPENSES" };
const rupees = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const period = (m: number, y: number) => `${MONTHS[m - 1].slice(0, 3)} ${y}`;
const ci = (s: string) => s.trim().toLowerCase();
const flatName = (wing: string, flat: string) => (wing === DEFAULT_WING ? flat : `${wing}-${flat}`);

interface Plan<R> {
  /** One entry per valid row, in file order. */
  items: (PreviewItem & { row: R })[];
  errors: RowIssue[];
  warnings: RowIssue[];
  notes: string[];
  apply: (tx: Tx, batchId: string) => Promise<void>;
}

export async function runImport(opts: RunOptions): Promise<ImportResult> {
  const now = opts.now ?? new Date();
  const empty = { counts: { create: 0, update: 0, skip: 0 }, items: [], notes: [], applied: false, warnings: [] };
  if (opts.text.length > MAX_IMPORT_CHARS) {
    return { ...empty, kind: opts.kind, rowCount: 0, errors: [{ line: 1, message: "The file is too large; split it into smaller files" }] };
  }

  const society = await prisma.society.findUnique({ where: { id: opts.societyId }, select: { hasWings: true } });
  if (!society) return { ...empty, kind: opts.kind, rowCount: 0, errors: [{ line: 1, message: "Society not found" }] };

  const v = validateTable(opts.kind, parseTable(opts.text), { hasWings: society.hasWings, now });
  const ctx = { ...opts, now, hasWings: society.hasWings };
  // Each builder needs the rows typed for its own kind
  const plan: Plan<unknown> =
    opts.kind === "flats" ? await planFlats(ctx, v.rows as FlatRow[])
    : opts.kind === "residents" ? await planResidents(ctx, v.rows as ResidentRow[])
    : opts.kind === "dues" ? await planDues(ctx, v.rows as DueRow[])
    : await planExpenses(ctx, v.rows as ExpenseRow[]);

  const errors = [...v.errors, ...plan.errors].sort((a, b) => a.line - b.line);
  const warnings = [...v.warnings, ...plan.warnings].sort((a, b) => a.line - b.line);
  const counts = { create: 0, update: 0, skip: 0 };
  for (const i of plan.items) counts[i.action]++;

  const result: ImportResult = {
    kind: opts.kind,
    rowCount: v.rowCount,
    errors,
    warnings,
    counts,
    items: plan.items.map(({ line, action, text }) => ({ line, action, text })),
    notes: plan.notes,
    applied: false,
  };
  if (!opts.apply || errors.length > 0 || counts.create + counts.update === 0) return result;

  await prisma.$transaction(
    async (tx) => {
      const batch = await tx.importBatch.create({
        data: {
          societyId: opts.societyId,
          kind: KIND_ENUM[opts.kind],
          createdById: opts.userId,
          fileName: opts.fileName?.slice(0, 200) || null,
          rowCount: v.rowCount,
          created: counts.create,
          updated: counts.update,
          skipped: counts.skip,
        },
        select: { id: true },
      });
      await plan.apply(tx, batch.id);
    },
    { timeout: 60_000, maxWait: 10_000 }
  );
  return { ...result, applied: true };
}

type Ctx = RunOptions & { now: Date; hasWings: boolean };

// ─────────────────────────────────────────────
// Finding existing flats from a file's Wing / Flat columns
// ─────────────────────────────────────────────

interface KnownFlat {
  id: string;
  number: string;
  wing: string;
  floorId: string;
  floor: number;
  configuration: string | null;
  areaSqFt: number | null;
}

async function loadFlats(societyId: string): Promise<KnownFlat[]> {
  const flats = await prisma.flat.findMany({
    where: { societyId },
    select: {
      id: true, number: true, configuration: true, areaSqFt: true, floorId: true,
      floor: { select: { number: true, wing: { select: { name: true } } } },
    },
  });
  return flats.map((f) => ({
    id: f.id,
    number: f.number,
    wing: f.floor.wing.name,
    floorId: f.floorId,
    floor: f.floor.number,
    configuration: f.configuration,
    areaSqFt: f.areaSqFt === null ? null : Number(f.areaSqFt),
  }));
}

/** Finds the flat a row refers to. Without a wing, the flat number must be unique, or written like A-101. */
export function flatResolver(flats: KnownFlat[], hasWings: boolean) {
  const label = (f: KnownFlat) => flatName(f.wing, f.number);
  return (ref: FlatRef): { flat: KnownFlat } | { error: string } => {
    const num = ci(ref.flat);
    const byNumber = flats.filter((f) => ci(f.number) === num);
    let found: KnownFlat[];
    if (!hasWings) {
      found = byNumber;
    } else if (ref.wing) {
      found = byNumber.filter((f) => ci(f.wing) === ci(ref.wing!));
    } else if (byNumber.length > 0) {
      found = byNumber;
    } else {
      const split = /^([a-z0-9]+)[\s\-/]+(.+)$/i.exec(ref.flat.trim());
      found = split ? flats.filter((f) => ci(f.wing) === ci(split[1]) && ci(f.number) === ci(split[2])) : [];
    }
    if (found.length === 1) return { flat: found[0] };
    const shown = ref.wing ? `${ref.wing}-${ref.flat}` : ref.flat;
    if (found.length > 1) {
      return { error: `Flat ${shown} matches ${found.map(label).join(", ")}; ${hasWings ? "fill the Wing column" : "flat numbers must be unique"}` };
    }
    return { error: `Flat ${shown} not found. Import or add your flats first` };
  };
}

// ─────────────────────────────────────────────
// Flats (creates wings and floors as needed, optional monthly maintenance)
// ─────────────────────────────────────────────

async function planFlats(ctx: Ctx, rows: FlatRow[]): Promise<Plan<FlatRow>> {
  const [flats, wings, charges] = await Promise.all([
    loadFlats(ctx.societyId),
    prisma.wing.findMany({ where: { societyId: ctx.societyId }, select: { id: true, name: true, floors: { select: { id: true, number: true } } } }),
    prisma.maintenanceCharge.findMany({
      where: { societyId: ctx.societyId },
      select: { flatId: true, startMonth: true, startYear: true, endMonth: true, endYear: true },
    }),
  ]);
  const errors: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  const items: Plan<FlatRow>["items"] = [];
  const newWings = new Map<string, string>(); // lowercase → spelling from the file
  const newFloors = new Set<string>();
  let chargeCount = 0;

  type Resolved = { row: FlatRow; wingName: string; existing?: KnownFlat; update: Prisma.FlatUpdateInput; charge: boolean };
  const resolved: Resolved[] = [];

  for (const row of rows) {
    const wingName = ctx.hasWings ? row.wing! : DEFAULT_WING;
    if (ctx.hasWings && ci(wingName) === DEFAULT_WING) {
      errors.push({ line: row.line, message: `"${DEFAULT_WING}" can't be used as a wing name` });
      continue;
    }
    const wing = wings.find((w) => ci(w.name) === ci(wingName));
    const displayWing = wing?.name ?? newWings.get(ci(wingName)) ?? wingName;
    const existing = flats.find((f) => ci(f.wing) === ci(wingName) && ci(f.number) === ci(row.flat));
    if (!existing) {
      if (!wing && !newWings.has(ci(wingName))) newWings.set(ci(wingName), wingName);
      if (!wing?.floors.some((f) => f.number === row.floor)) newFloors.add(`${ci(wingName)}|${row.floor}`);
    }
    const name = flatName(displayWing, existing?.number ?? row.flat);
    const parts: string[] = [];
    const update: Prisma.FlatUpdateInput = {};
    if (existing) {
      if (existing.floor !== row.floor) warnings.push({ line: row.line, message: `${name} already exists on floor ${existing.floor}; floor not changed` });
      if (row.configuration && row.configuration !== existing.configuration) {
        update.configuration = row.configuration;
        parts.push(row.configuration);
      }
      if (row.areaSqFt !== null && row.areaSqFt !== existing.areaSqFt) {
        update.areaSqFt = row.areaSqFt;
        parts.push(`${row.areaSqFt} sq ft`);
      }
    } else {
      if (row.configuration) parts.push(row.configuration);
      if (row.areaSqFt !== null) parts.push(`${row.areaSqFt} sq ft`);
    }

    let charge = false;
    if (row.maintenance !== null) {
      const start = toIdx(row.from.month, row.from.year);
      const clash = existing && charges.find((c) =>
        c.flatId === existing.id &&
        periodsOverlap(start, null, toIdx(c.startMonth, c.startYear), c.endMonth !== null && c.endYear !== null ? toIdx(c.endMonth, c.endYear) : null)
      );
      if (clash) {
        warnings.push({ line: row.line, message: `${name} already has a maintenance charge from ${period(clash.startMonth, clash.startYear)}; not changed` });
      } else {
        charge = true;
        chargeCount++;
        parts.push(`${rupees(row.maintenance)}/month from ${period(row.from.month, row.from.year)}`);
      }
    }

    const action: ImportAction = !existing ? "create" : parts.length > 0 ? "update" : "skip";
    const text =
      action === "create" ? `Add ${name}, floor ${row.floor}${parts.length ? ` · ${parts.join(" · ")}` : ""}`
      : action === "update" ? `Update ${name}: ${parts.join(" · ")}`
      : `${name} already exists`;
    items.push({ line: row.line, action, text, row });
    resolved.push({ row, wingName, existing, update, charge });
  }

  const notes: string[] = [];
  if (newWings.size && ctx.hasWings) notes.push(`${newWings.size} wing${newWings.size > 1 ? "s" : ""} will be created: ${[...newWings.values()].join(", ")}`);
  if (newFloors.size) notes.push(`${newFloors.size} floor${newFloors.size > 1 ? "s" : ""} will be created`);
  if (chargeCount) notes.push(`${chargeCount} monthly maintenance charge${chargeCount > 1 ? "s" : ""} will be set. Dues are raised automatically each month from the start month; earlier months can be imported as past dues`);

  return {
    items, errors, warnings, notes,
    apply: async (tx) => {
      const wingIds = new Map(wings.map((w) => [ci(w.name), w.id]));
      for (const [key, spelling] of newWings) {
        const w = await tx.wing.upsert({
          where: { societyId_name: { societyId: ctx.societyId, name: spelling } },
          create: { societyId: ctx.societyId, name: spelling },
          update: {},
          select: { id: true },
        });
        wingIds.set(key, w.id);
      }
      const floorIds = new Map<string, string>();
      for (const w of wings) for (const f of w.floors) floorIds.set(`${ci(w.name)}|${f.number}`, f.id);
      for (const key of newFloors) {
        const [wingKey, num] = key.split("|");
        const f = await tx.floor.upsert({
          where: { wingId_number: { wingId: wingIds.get(wingKey)!, number: Number(num) } },
          create: { wingId: wingIds.get(wingKey)!, number: Number(num) },
          update: {},
          select: { id: true },
        });
        floorIds.set(key, f.id);
      }

      const toCreate = resolved.filter((r) => !r.existing);
      await tx.flat.createMany({
        data: toCreate.map((r) => ({
          societyId: ctx.societyId,
          floorId: floorIds.get(`${ci(r.wingName)}|${r.row.floor}`)!,
          number: r.row.flat,
          configuration: r.row.configuration,
          areaSqFt: r.row.areaSqFt,
        })),
        skipDuplicates: true,
      });
      for (const r of resolved) {
        if (r.existing && Object.keys(r.update).length) await tx.flat.update({ where: { id: r.existing.id }, data: r.update });
      }

      const withCharge = resolved.filter((r) => r.charge);
      if (withCharge.length) {
        const created = await tx.flat.findMany({
          where: { societyId: ctx.societyId, floorId: { in: [...floorIds.values()] } },
          select: { id: true, number: true, floorId: true },
        });
        const idFor = (r: Resolved) =>
          r.existing?.id ?? created.find((f) => f.floorId === floorIds.get(`${ci(r.wingName)}|${r.row.floor}`) && f.number === r.row.flat)?.id;
        await tx.maintenanceCharge.createMany({
          data: withCharge.flatMap((r) => {
            const flatId = idFor(r);
            return flatId
              ? [{ societyId: ctx.societyId, flatId, amount: r.row.maintenance!, startMonth: r.row.from.month, startYear: r.row.from.year, description: "Set by import" }]
              : [];
          }),
        });
      }
    },
  };
}

// ─────────────────────────────────────────────
// Residents (new accounts sign in with "Forgot password")
// ─────────────────────────────────────────────

async function planResidents(ctx: Ctx, rows: ResidentRow[]): Promise<Plan<ResidentRow>> {
  const flats = await loadFlats(ctx.societyId);
  const resolve = flatResolver(flats, ctx.hasWings);
  const emails = [...new Set(rows.map((r) => r.email))];
  const users = emails.length
    ? await prisma.user.findMany({
        where: { OR: emails.map((e) => ({ email: { equals: e, mode: "insensitive" as const } })) },
        select: { id: true, email: true, name: true, societyId: true, isActive: true, flatResidents: { select: { flatId: true } } },
      })
    : [];
  const userByEmail = new Map(users.map((u) => [ci(u.email), u]));

  const errors: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  const items: Plan<ResidentRow>["items"] = [];

  // Person-level details come from the first row for each new email
  const people = new Map<string, { name: string; phone: string | null; role: ResidentRow["role"]; owner: boolean; line: number }>();
  const links: { email: string; flatId: string; type: "OWNER" | "TENANT"; primary: boolean }[] = [];
  const seenLink = new Set<string>();

  for (const row of rows) {
    const found = resolve(row);
    if ("error" in found) {
      errors.push({ line: row.line, message: found.error });
      continue;
    }
    const flat = found.flat;
    const label = flatName(flat.wing, flat.number);
    const existing = userByEmail.get(row.email);
    if (existing && existing.societyId !== ctx.societyId) {
      errors.push({ line: row.line, message: `${row.email} is already used by another account; use a different email` });
      continue;
    }
    const linkKey = `${row.email}|${flat.id}`;
    if (seenLink.has(linkKey)) {
      errors.push({ line: row.line, message: `${row.email} is linked to ${label} twice` });
      continue;
    }
    seenLink.add(linkKey);

    if (!existing) {
      const p = people.get(row.email);
      if (!p) {
        people.set(row.email, { name: row.name, phone: row.phone, role: row.role, owner: row.type === "OWNER", line: row.line });
      } else {
        if (p.name !== row.name) warnings.push({ line: row.line, message: `Different name for ${row.email} than line ${p.line}; "${p.name}" is used` });
        if (row.role && p.role && row.role !== p.role) {
          errors.push({ line: row.line, message: `Committee role for ${row.email} differs from line ${p.line}` });
          continue;
        }
        p.role ??= row.role;
        p.phone ??= row.phone;
        p.owner ||= row.type === "OWNER";
      }
    } else if (row.role) {
      warnings.push({ line: row.line, message: `${row.email} is already a member; their role is not changed by an import` });
    }

    const type = row.type === "OWNER" ? "owner" : "tenant";
    if (existing?.flatResidents.some((fr) => fr.flatId === flat.id)) {
      items.push({ line: row.line, action: "skip", text: `${existing.name} is already linked to ${label}`, row });
      continue;
    }
    links.push({ email: row.email, flatId: flat.id, type: row.type, primary: row.primary });
    items.push(
      existing
        ? { line: row.line, action: "update", text: `Link ${existing.name} to ${label} as ${type}`, row }
        : { line: row.line, action: "create", text: `Add ${row.name} (${row.email}) to ${label} as ${type}${row.primary ? ", primary contact" : ""}${row.role ? `, ${row.role.toLowerCase()}` : ""}`, row }
    );
  }

  const newCount = [...people.keys()].length;
  const notes: string[] = [];
  if (newCount) {
    notes.push(`${newCount} new account${newCount > 1 ? "s" : ""} will be created. They sign in by choosing "Forgot password" on the sign-in page and setting their own password, then verify their email and mobile`);
  }

  return {
    items, errors, warnings, notes,
    apply: async (tx) => {
      // One random password nobody knows; every new member sets their own through "Forgot password"
      const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
      const created = people.size
        ? await tx.user.createManyAndReturn({
            data: [...people].map(([email, p]) => ({
              email,
              name: p.name,
              phone: p.phone,
              role: p.role ?? (p.owner ? "OWNER" : "TENANT"),
              societyId: ctx.societyId,
              passwordHash,
            })),
            select: { id: true, email: true },
          })
        : [];
      const ids = new Map<string, string>([
        ...users.map((u) => [ci(u.email), u.id] as const),
        ...created.map((u) => [ci(u.email), u.id] as const),
      ]);
      const data = links.flatMap((l) => {
        const userId = ids.get(l.email);
        return userId ? [{ flatId: l.flatId, userId, type: l.type, isPrimary: l.primary }] : [];
      });
      await tx.flatResident.createMany({ data, skipDuplicates: true });
      await tx.flat.updateMany({ where: { societyId: ctx.societyId, id: { in: data.map((d) => d.flatId) } }, data: { isOccupied: true } });
      const tenants = data.filter((d) => d.type === "TENANT");
      if (tenants.length) {
        await tx.tenantRecord.createMany({ data: tenants.map((t) => ({ flatId: t.flatId, userId: t.userId, startDate: ctx.now })) });
      }
    },
  };
}

// ─────────────────────────────────────────────
// Past dues: history and arrears (never announced as new dues)
// ─────────────────────────────────────────────

async function planDues(ctx: Ctx, rows: DueRow[]): Promise<Plan<DueRow>> {
  const flats = await loadFlats(ctx.societyId);
  const resolve = flatResolver(flats, ctx.hasWings);
  const existing = await prisma.maintenancePayment.findMany({
    where: { societyId: ctx.societyId },
    select: { flatId: true, month: true, year: true, chargeKey: true },
  });
  const have = new Set(existing.map((p) => `${p.flatId}|${p.month}|${p.year}|${p.chargeKey}`));
  const nowIdx = toIdx(ctx.now.getMonth() + 1, ctx.now.getFullYear());

  const errors: RowIssue[] = [];
  const items: Plan<DueRow>["items"] = [];
  const toCreate: Prisma.MaintenancePaymentCreateManyInput[] = [];
  let outstanding = 0;

  for (const row of rows) {
    const found = resolve(row);
    if ("error" in found) {
      errors.push({ line: row.line, message: found.error });
      continue;
    }
    const flat = found.flat;
    const label = flatName(flat.wing, flat.number);
    const chargeKey = chargeKeyFor(row.label);
    const what = `${row.label} for ${label}, ${period(row.month, row.year)}`;
    if (have.has(`${flat.id}|${row.month}|${row.year}|${chargeKey}`)) {
      items.push({ line: row.line, action: "skip", text: `${what} already exists`, row });
      continue;
    }
    const fullyPaid = row.paid >= row.amount;
    const status = fullyPaid ? "PAID" : toIdx(row.month, row.year) < nowIdx ? "OVERDUE" : "PENDING";
    outstanding += row.amount - row.paid;
    toCreate.push({
      societyId: ctx.societyId,
      flatId: flat.id,
      chargeKey,
      label: chargeKey === "MAINTENANCE" ? "Maintenance" : row.label,
      month: row.month,
      year: row.year,
      amount: row.amount,
      amountPaid: row.paid,
      status,
      paidAt: fullyPaid ? row.paidOn ?? ctx.now : null,
      notes: ["Imported from earlier records", row.reference && `ref ${row.reference}`, !fullyPaid && row.paidOn && `paid ${row.paidOn.toISOString().slice(0, 10)}`]
        .filter(Boolean)
        .join(" · "),
    });
    const state = fullyPaid ? "paid" : row.paid > 0 ? `${rupees(row.paid)} paid, ${rupees(row.amount - row.paid)} due` : "unpaid";
    items.push({ line: row.line, action: "create", text: `${what}: ${rupees(row.amount)}, ${state}`, row });
  }

  const notes: string[] = [];
  if (toCreate.length) {
    notes.push(`Outstanding from these rows: ${rupees(Math.round(outstanding * 100) / 100)}. Imported dues are not announced as new dues; unpaid ones from recent months get the usual reminders`);
    notes.push("Payments in this file are kept as records only. They are not added to the bank tally or the yearly statement, so set your bank account's opening balance as of the date you start using the app");
  }

  return {
    items, errors, warnings: [], notes,
    apply: async (tx, batchId) => {
      await tx.maintenancePayment.createMany({ data: toCreate.map((d) => ({ ...d, importBatchId: batchId })), skipDuplicates: true });
    },
  };
}

// ─────────────────────────────────────────────
// Past expenses
// ─────────────────────────────────────────────

async function planExpenses(ctx: Ctx, rows: ExpenseRow[]): Promise<Plan<ExpenseRow>> {
  const errors: RowIssue[] = [];
  const items: Plan<ExpenseRow>["items"] = [];
  const toCreate: ExpenseRow[] = [];
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const key = (date: Date, title: string, amount: number) => `${dayKey(date)}|${ci(title)}|${amount}`;

  const dates = rows.map((r) => r.date.getTime());
  const [existing, primary] = await Promise.all([
    rows.length
      ? prisma.expense.findMany({
          where: { societyId: ctx.societyId, date: { gte: new Date(Math.min(...dates)), lte: new Date(Math.max(...dates) + 86_400_000) } },
          select: { date: true, title: true, amount: true },
        })
      : [],
    prisma.bankAccount.findFirst({ where: { societyId: ctx.societyId, isPrimary: true }, select: { openingDate: true, name: true } }),
  ]);
  const have = new Set(existing.map((e) => key(e.date, e.title, Number(e.amount))));

  for (const row of rows) {
    const what = `${row.title}, ${dayKey(row.date).split("-").reverse().join("/")}, ${rupees(row.amount)}`;
    if (have.has(key(row.date, row.title, row.amount))) {
      items.push({ line: row.line, action: "skip", text: `${what} is already recorded`, row });
      continue;
    }
    toCreate.push(row);
    items.push({ line: row.line, action: "create", text: `${what} · ${row.category}${row.channel === "CASH" ? " · cash" : ""}`, row });
  }

  const notes: string[] = [];
  const total = toCreate.reduce((n, r) => n + Math.round(r.amount * 100), 0) / 100;
  if (toCreate.length) notes.push(`${toCreate.length} expense${toCreate.length > 1 ? "s" : ""} totalling ${rupees(total)}`);
  if (primary) {
    const counted = toCreate.filter((r) => r.date >= primary.openingDate);
    if (counted.length) {
      notes.push(`${counted.length} of these are on or after the opening date of "${primary.name}" and will be deducted in the bank tally (cash ones from cash in hand)`);
    }
  }

  return {
    items, errors, warnings: [], notes,
    apply: async (tx, batchId) => {
      await tx.expense.createMany({
        data: toCreate.map((r) => ({
          societyId: ctx.societyId,
          addedById: ctx.userId,
          title: r.title,
          category: r.category,
          amount: r.amount,
          date: r.date,
          description: r.notes,
          paidVia: r.channel,
          importBatchId: batchId,
        })),
      });
    },
  };
}

/** Counts shown on the wizard's steps, so a society can see what it has already brought in. */
export async function getImportProgress(societyId: string) {
  const [flats, members, dues, expenses, batches] = await Promise.all([
    prisma.flat.count({ where: { societyId } }),
    prisma.user.count({ where: { societyId } }),
    prisma.maintenancePayment.count({ where: { societyId } }),
    prisma.expense.count({ where: { societyId } }),
    prisma.importBatch.findMany({
      where: { societyId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, kind: true, fileName: true, created: true, updated: true, createdAt: true, createdBy: { select: { name: true } } },
    }),
  ]);
  return { flats, members, dues, expenses, batches };
}
