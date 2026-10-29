// Pure: what each import expects (columns, template) and row-by-row validation of a parsed
// table. Nothing here touches the database; src/lib/queries/import.ts checks rows against it.
import { normalizeHeader } from "./csv";
import { floorFromFlatNumber, parseAmount, parseDate, parseFloor, parseMonth, parseYesNo } from "./formats";
import { normalizePhone } from "@/lib/utils/phone";
import { EXPENSE_CATEGORIES } from "@/lib/utils/expense-categories";

export const IMPORT_KINDS = ["flats", "residents", "dues", "expenses"] as const;
export type ImportKindKey = (typeof IMPORT_KINDS)[number];

export const MAX_IMPORT_ROWS = 2000;
/** Kept well under Next's 1 MB server action body limit; 2,000 rows of a typical sheet are ~200 KB. */
export const MAX_IMPORT_CHARS = 500_000;

export interface Column {
  key: string;
  label: string;
  /** Other header spellings accepted for this column (compared after normalizeHeader). */
  aliases: string[];
  /** true = always required; "wings" = required only when the society has wings. */
  required?: boolean | "wings";
  help: string;
}

export interface RowIssue {
  line: number; // 1-based line in the file (the header is line 1)
  message: string;
}

export interface ValidateContext {
  hasWings: boolean;
  /** Today, so tests can pin it. */
  now: Date;
}

const WING: Column = { key: "wing", label: "Wing", aliases: ["building", "block", "tower", "wingname"], required: "wings", help: "Wing, block or building name, e.g. A." };
// Residents and dues find an existing flat, so the wing can be left out when the flat number is unique
const WING_REF: Column = { ...WING, required: false, help: "Wing of the flat. Can be blank when the flat number appears in only one wing." };
const FLAT: Column = { key: "flat", label: "Flat", aliases: ["flatno", "flatnumber", "unit", "unitno", "doorno", "flatunit", "apartment"], required: true, help: "Flat number as written on the door, e.g. 101." };

export const COLUMNS: Record<ImportKindKey, Column[]> = {
  flats: [
    WING,
    { key: "floor", label: "Floor", aliases: ["floorno", "floornumber"], help: "0 or G for ground. Leave blank to read it from the flat number (101 → 1st floor)." },
    FLAT,
    { key: "configuration", label: "Configuration", aliases: ["config", "bhk", "flattype", "type"], help: "Optional, e.g. 2 BHK. Used to target other charges." },
    { key: "area", label: "Area sq ft", aliases: ["areasqft", "sqft", "carpetarea", "builtuparea", "area"], help: "Optional, in square feet." },
    { key: "maintenance", label: "Monthly maintenance", aliases: ["monthlymaintenance", "maintenanceamount", "monthlycharge", "maintenance"], help: "Optional. Sets the flat's monthly maintenance charge." },
    { key: "from", label: "Maintenance from", aliases: ["maintenancefrom", "frommonth", "startmonth", "chargefrom"], help: "Month the charge starts, e.g. Apr 2026. Blank = this month." },
  ],
  residents: [
    { key: "name", label: "Name", aliases: ["fullname", "membername", "ownername", "residentname"], required: true, help: "Full name." },
    { key: "email", label: "Email", aliases: ["emailid", "emailaddress", "mail"], required: true, help: "Used to sign in. One account per email." },
    { key: "phone", label: "Mobile", aliases: ["phone", "mobileno", "mobilenumber", "phoneno", "phonenumber", "contact", "contactno", "whatsapp"], help: "10-digit Indian mobile number." },
    WING_REF,
    FLAT,
    { key: "type", label: "Owner or tenant", aliases: ["ownerortenant", "ownertenant", "residenttype", "occupancy", "type"], help: "owner (default) or tenant." },
    { key: "primary", label: "Primary contact", aliases: ["primarycontact", "maincontact", "primary"], help: "yes if messages for the flat should go to this person." },
    { key: "role", label: "Committee role", aliases: ["committeerole", "designation", "role"], help: "Optional: admin, secretary or treasurer." },
  ],
  dues: [
    WING_REF,
    FLAT,
    { key: "month", label: "Month", aliases: ["period", "billmonth", "formonth", "billingmonth"], required: true, help: "e.g. Apr 2026 or 04/2026." },
    { key: "amount", label: "Amount", aliases: ["amountdue", "billamount", "due", "chargeamount", "billed"], required: true, help: "What was billed for that month." },
    { key: "paid", label: "Paid", aliases: ["amountpaid", "paidamount", "received", "amountreceived", "collected"], help: "What the flat has paid against it. Blank = nothing paid." },
    { key: "charge", label: "Charge", aliases: ["head", "chargename", "description", "label", "particulars"], help: "Blank = Maintenance. Use a name like Sinking fund for other charges." },
    { key: "paidOn", label: "Paid on", aliases: ["paidon", "paymentdate", "receivedon", "datepaid", "dateofpayment"], help: "Optional date of payment." },
    { key: "reference", label: "Reference", aliases: ["utr", "receiptno", "chequeno", "ref", "transactionid"], help: "Optional receipt, cheque or UTR number, kept as a note." },
  ],
  expenses: [
    { key: "date", label: "Date", aliases: ["expensedate", "billdate", "paidon", "paymentdate"], required: true, help: "e.g. 15/04/2026 (day first)." },
    { key: "title", label: "Title", aliases: ["particulars", "expense", "details", "item", "description", "narration"], required: true, help: "What was paid for." },
    { key: "amount", label: "Amount", aliases: ["paidamount", "total", "debit", "amountpaid"], required: true, help: "Amount paid in rupees." },
    { key: "category", label: "Category", aliases: ["head", "expensehead", "type"], help: `One of: ${EXPENSE_CATEGORIES.join(", ")}. Blank = Other.` },
    { key: "paidVia", label: "Paid via", aliases: ["paidvia", "mode", "paymentmode", "paidby"], help: "bank (default: UPI, cheque, transfer) or cash." },
    { key: "notes", label: "Notes", aliases: ["remarks", "vendor", "paidto", "description", "narration"], help: "Optional, e.g. vendor name." },
  ],
};

/** Example rows for the downloadable template. */
const EXAMPLES: Record<ImportKindKey, string[][]> = {
  flats: [
    ["A", "1", "101", "2 BHK", "850", "2500", ""],
    ["A", "1", "102", "3 BHK", "1150", "3000", ""],
    ["B", "G", "G01", "1 BHK", "600", "2000", "Apr 2026"],
  ],
  residents: [
    ["Ravi Mehta", "ravi.mehta@example.com", "9876543210", "A", "101", "owner", "yes", "admin"],
    ["Sunita Iyer", "sunita@example.com", "9822012345", "A", "102", "owner", "yes", ""],
    ["Arjun Khan", "arjun.k@example.com", "9900011223", "A", "102", "tenant", "", ""],
  ],
  dues: [
    ["A", "101", "Aug 2026", "2500", "2500", "", "10/08/2026", "UTR 4512"],
    ["A", "101", "Sep 2026", "2500", "1000", "", "", ""],
    ["A", "102", "Sep 2026", "3000", "", "", "", ""],
    ["A", "102", "Sep 2026", "5000", "", "Sinking fund", "", ""],
  ],
  expenses: [
    ["05/09/2026", "Electricity bill - common area", "4820", "Electricity", "bank", "MSEDCL"],
    ["10/09/2026", "Watchman salary", "12000", "Salary", "bank", ""],
    ["18/09/2026", "Plumber - terrace tank", "1500", "Repairs & Maintenance", "cash", "Sharma Plumbing"],
  ],
};

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV text for the template: the header row plus example rows. Wing column dropped for wingless societies. */
export function templateCsv(kind: ImportKindKey, hasWings: boolean): string {
  const cols = COLUMNS[kind];
  const keep = cols.map((c) => hasWings || c.key !== "wing");
  const pick = (row: string[]) => row.filter((_, i) => keep[i]);
  return [pick(cols.map((c) => c.label)), ...EXAMPLES[kind].map(pick)]
    .map((r) => r.map(csvCell).join(","))
    .join("\n") + "\n";
}

// ─────────────────────────────────────────────
// Header mapping
// ─────────────────────────────────────────────

/** Maps each column key to its index in the header row. Each header is used for at most one column. */
export function mapHeaders(kind: ImportKindKey, header: string[], ctx: ValidateContext) {
  const cols = COLUMNS[kind];
  const index: Record<string, number> = {};
  const ignored: string[] = [];
  header.forEach((h, i) => {
    const n = normalizeHeader(h);
    if (!n) return;
    // Exact key/label match first, then aliases, so "Description" can fall through to a later column
    const exact = cols.find((c) => !(c.key in index) && (normalizeHeader(c.key) === n || normalizeHeader(c.label) === n));
    const col = exact ?? cols.find((c) => !(c.key in index) && c.aliases.includes(n));
    if (col) index[col.key] = i;
    else ignored.push(h);
  });
  const missing = cols
    .filter((c) => (c.required === true || (c.required === "wings" && ctx.hasWings)) && !(c.key in index))
    .map((c) => c.label);
  return { index, ignored, missing };
}

// ─────────────────────────────────────────────
// Row types
// ─────────────────────────────────────────────

export interface FlatRef {
  wing: string | null; // null when the society has no wings, or the file left it blank
  flat: string;
}

export interface FlatRow extends FlatRef {
  line: number;
  floor: number;
  configuration: string | null;
  areaSqFt: number | null;
  maintenance: number | null;
  from: { month: number; year: number };
}

export type CommitteeRole = "ADMIN" | "SECRETARY" | "TREASURER";

export interface ResidentRow extends FlatRef {
  line: number;
  name: string;
  email: string;
  phone: string | null;
  type: "OWNER" | "TENANT";
  primary: boolean;
  role: CommitteeRole | null;
}

export interface DueRow extends FlatRef {
  line: number;
  month: number;
  year: number;
  amount: number;
  paid: number;
  label: string;
  paidOn: Date | null;
  reference: string | null;
}

export interface ExpenseRow {
  line: number;
  date: Date;
  title: string;
  amount: number;
  category: string;
  channel: "BANK" | "CASH";
  notes: string | null;
}

export interface RowsByKind {
  flats: FlatRow;
  residents: ResidentRow;
  dues: DueRow;
  expenses: ExpenseRow;
}

export interface Validated<K extends ImportKindKey> {
  rows: RowsByKind[K][];
  errors: RowIssue[];
  warnings: RowIssue[];
  rowCount: number;
}

/** Dues for "Maintenance" share the key monthly generation uses, so they are never raised twice. */
export function chargeKeyFor(label: string): string {
  const n = label.trim().toLowerCase().replace(/\s+/g, " ");
  return n === "" || n === "maintenance" ? "MAINTENANCE" : `IMPORT:${n}`;
}

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const flatKey = (r: FlatRef) => `${(r.wing ?? "").toLowerCase()}|${r.flat.toLowerCase()}`;
const monthIdx = (m: number, y: number) => y * 12 + m;

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

/**
 * Validates a parsed table (header row first) for one kind. Rows with errors are left out of
 * `rows`; the import refuses to run while any errors remain, so the file is fixed first.
 */
export function validateTable<K extends ImportKindKey>(kind: K, table: string[][], ctx: ValidateContext): Validated<K> {
  const errors: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  const out: RowsByKind[K][] = [];

  if (table.length < 2) {
    return { rows: [], errors: [{ line: 1, message: "The file has no rows below the header row" }], warnings, rowCount: 0 };
  }
  if (table.length - 1 > MAX_IMPORT_ROWS) {
    return { rows: [], errors: [{ line: 1, message: `At most ${MAX_IMPORT_ROWS} rows per import; split the file` }], warnings, rowCount: table.length - 1 };
  }

  const { index, ignored, missing } = mapHeaders(kind, table[0], ctx);
  if (missing.length) {
    return { rows: [], errors: [{ line: 1, message: `Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}` }], warnings, rowCount: table.length - 1 };
  }
  if (ignored.length) warnings.push({ line: 1, message: `Ignored column${ignored.length > 1 ? "s" : ""}: ${ignored.join(", ")}` });
  if (!ctx.hasWings && "wing" in index) warnings.push({ line: 1, message: "Your society has no wings, so the Wing column is ignored" });

  const nowIdx = monthIdx(ctx.now.getMonth() + 1, ctx.now.getFullYear());
  const seen = new Map<string, number>();

  for (let r = 1; r < table.length; r++) {
    const line = r + 1;
    const cells = table[r];
    const get = (key: string) => (key in index ? (cells[index[key]] ?? "").trim() : "");
    const fail = (message: string) => errors.push({ line, message });
    const warn = (message: string) => warnings.push({ line, message });

    const ref = (): FlatRef | null => {
      const flat = get("flat");
      if (!flat || flat.length > 20) {
        fail(flat ? "Flat number is too long" : "Flat is blank");
        return null;
      }
      const wing = ctx.hasWings ? get("wing") || null : null;
      return { wing, flat };
    };

    if (kind === "flats") {
      const f = ref();
      if (!f) continue;
      if (ctx.hasWings && !f.wing) { fail("Wing is blank"); continue; }
      if (f.wing && f.wing.length > 30) { fail("Wing name is too long"); continue; }
      const floorRaw = get("floor");
      const floor = floorRaw ? parseFloor(floorRaw) : floorFromFlatNumber(f.flat);
      if (floor === null) { fail(floorRaw ? `Floor "${floorRaw}" is not a number` : `Can't tell the floor of flat ${f.flat}; fill the Floor column`); continue; }
      const areaRaw = get("area");
      const area = areaRaw ? parseAmount(areaRaw) : null;
      if (areaRaw && (area === null || area <= 0 || area > 100000)) { fail(`Area "${areaRaw}" is not a valid number of sq ft`); continue; }
      const mRaw = get("maintenance");
      const maintenance = mRaw ? parseAmount(mRaw) : null;
      if (mRaw && (maintenance === null || maintenance <= 0 || maintenance > 1_000_000)) { fail(`Monthly maintenance "${mRaw}" is not a valid amount`); continue; }
      const fromRaw = get("from");
      const from = fromRaw ? parseMonth(fromRaw) : { month: ctx.now.getMonth() + 1, year: ctx.now.getFullYear() };
      if (!from) { fail(`Maintenance from "${fromRaw}" is not a month (use e.g. Apr 2026)`); continue; }
      if (fromRaw && maintenance === null) warn("Maintenance from is ignored without a monthly maintenance amount");
      const key = flatKey(f);
      if (seen.has(key)) { fail(`Flat ${f.flat}${f.wing ? ` in wing ${f.wing}` : ""} is listed twice (also line ${seen.get(key)})`); continue; }
      seen.set(key, line);
      const configuration = get("configuration").slice(0, 30) || null;
      out.push({ ...f, line, floor, configuration, areaSqFt: area, maintenance, from } as RowsByKind[K]);
    }

    if (kind === "residents") {
      const name = get("name");
      const email = get("email").toLowerCase();
      if (name.length < 2) { fail("Name is blank or too short"); continue; }
      if (name.length > 100) { fail("Name is too long"); continue; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fail(email ? `"${email}" is not a valid email` : "Email is blank"); continue; }
      const f = ref();
      if (!f) continue;
      const phoneRaw = get("phone");
      const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
      if (phoneRaw && !phone) warn(`Mobile "${phoneRaw}" is not a 10-digit Indian number; left blank`);
      const typeRaw = get("type").toLowerCase();
      const type = typeRaw === "" || /^(owner|o|landlord|self)$/.test(typeRaw) ? "OWNER" : /^(tenant|t|rented|renter)$/.test(typeRaw) ? "TENANT" : null;
      if (!type) { fail(`Owner or tenant "${get("type")}" should be owner or tenant`); continue; }
      const primary = parseYesNo(get("primary"));
      if (primary === null) { fail(`Primary contact "${get("primary")}" should be yes or no`); continue; }
      const roleRaw = get("role").toLowerCase();
      const role: CommitteeRole | null | undefined =
        roleRaw === "" || /^(member|resident|owner|tenant|none)$/.test(roleRaw) ? null
        : roleRaw === "admin" ? "ADMIN"
        : roleRaw === "secretary" ? "SECRETARY"
        : roleRaw === "treasurer" ? "TREASURER"
        : undefined;
      if (role === undefined) { fail(`Committee role "${get("role")}" should be admin, secretary or treasurer`); continue; }
      const key = `${email}|${flatKey(f)}`;
      if (seen.has(key)) { fail(`${email} is linked to flat ${f.flat} twice (also line ${seen.get(key)})`); continue; }
      seen.set(key, line);
      out.push({ ...f, line, name, email, phone, type, primary, role } as RowsByKind[K]);
    }

    if (kind === "dues") {
      const f = ref();
      if (!f) continue;
      const monthRaw = get("month");
      const period = parseMonth(monthRaw);
      if (!period) { fail(monthRaw ? `Month "${monthRaw}" is not a month (use e.g. Apr 2026)` : "Month is blank"); continue; }
      if (monthIdx(period.month, period.year) > nowIdx) { fail("Month is in the future; only past and current dues can be imported"); continue; }
      const amount = parseAmount(get("amount"));
      if (amount === null || amount <= 0 || amount > 10_000_000) { fail(`Amount "${get("amount")}" is not a valid amount`); continue; }
      const paidRaw = get("paid");
      const paid = paidRaw ? parseAmount(paidRaw) : 0;
      if (paid === null) { fail(`Paid "${paidRaw}" is not a valid amount`); continue; }
      if (paid > amount) { fail("Paid is more than the amount. Import the due with Paid equal to Amount; record the extra as an advance payment after the import"); continue; }
      const paidOnRaw = get("paidOn");
      const paidOn = paidOnRaw ? parseDate(paidOnRaw) : null;
      if (paidOnRaw && !paidOn) { fail(`Paid on "${paidOnRaw}" is not a date (use e.g. 15/04/2026)`); continue; }
      const label = get("charge").slice(0, 60) || "Maintenance";
      const key = `${flatKey(f)}|${period.month}-${period.year}|${chargeKeyFor(label)}`;
      if (seen.has(key)) { fail(`${label} for flat ${f.flat}, ${period.month}/${period.year} is listed twice (also line ${seen.get(key)})`); continue; }
      seen.set(key, line);
      const reference = get("reference").slice(0, 60) || null;
      out.push({ ...f, line, ...period, amount, paid, label, paidOn, reference } as RowsByKind[K]);
    }

    if (kind === "expenses") {
      const dateRaw = get("date");
      const date = parseDate(dateRaw);
      if (!date) { fail(dateRaw ? `Date "${dateRaw}" is not a date (use e.g. 15/04/2026)` : "Date is blank"); continue; }
      if (date.getTime() > ctx.now.getTime()) { fail("Date is in the future"); continue; }
      const title = get("title");
      if (title.length < 2) { fail("Title is blank or too short"); continue; }
      const amount = parseAmount(get("amount"));
      if (amount === null || amount <= 0 || amount > 10_000_000) { fail(`Amount "${get("amount")}" is not a valid amount`); continue; }
      const catRaw = get("category");
      const category = EXPENSE_CATEGORIES.find((c) => sameText(c, catRaw)) ?? (catRaw.slice(0, 40) || "Other");
      const viaRaw = get("paidVia").toLowerCase();
      const channel = /^(cash|petty cash)$/.test(viaRaw) ? "CASH" : "BANK";
      if (viaRaw && channel === "BANK" && !/^(bank|upi|cheque|check|neft|rtgs|imps|transfer|online|card|netbanking|gpay|phonepe|paytm)$/.test(viaRaw)) {
        warn(`Paid via "${get("paidVia")}" was read as bank`);
      }
      const key = `${date.toISOString().slice(0, 10)}|${title.toLowerCase()}|${amount}`;
      if (seen.has(key)) warn(`Same date, title and amount as line ${seen.get(key)}; both will be imported`);
      seen.set(key, line);
      out.push({ line, date, title: title.slice(0, 200), amount, category, channel, notes: get("notes").slice(0, 500) || null } as RowsByKind[K]);
    }
  }

  return { rows: out, errors, warnings, rowCount: table.length - 1 };
}
