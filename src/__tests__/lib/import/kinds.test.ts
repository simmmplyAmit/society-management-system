import { describe, it, expect } from "vitest";
import { parseTable } from "@/lib/import/csv";
import { chargeKeyFor, IMPORT_KINDS, mapHeaders, templateCsv, validateTable, type ImportKindKey } from "@/lib/import/kinds";

const now = new Date(2026, 9, 29); // 29 Oct 2026
const ctx = { hasWings: true, now };
const check = (kind: ImportKindKey, text: string, hasWings = true) => validateTable(kind, parseTable(text), { hasWings, now });

describe("templates", () => {
  it.each(IMPORT_KINDS.flatMap((k) => [[k, true], [k, false]] as const))("%s template (wings: %s) validates cleanly", (kind, hasWings) => {
    const v = check(kind, templateCsv(kind, hasWings), hasWings);
    expect(v.errors).toEqual([]);
    expect(v.rows.length).toBe(v.rowCount);
  });

  it("drops the wing column for wingless societies", () => {
    expect(templateCsv("flats", false).split("\n")[0]).toBe("Floor,Flat,Configuration,Area sq ft,Monthly maintenance,Maintenance from");
  });
});

describe("mapHeaders", () => {
  it("accepts common spellings and reports unused columns", () => {
    const m = mapHeaders("residents", ["Member Name", "Email ID", "Mobile No.", "Flat No", "Remarks"], ctx);
    expect(m.index).toEqual({ name: 0, email: 1, phone: 2, flat: 3 });
    expect(m.ignored).toEqual(["Remarks"]);
    expect(m.missing).toEqual([]);
  });

  it("lets a second matching header fall through to a later column", () => {
    const m = mapHeaders("expenses", ["Date", "Title", "Amount", "Description"], ctx);
    expect(m.index).toMatchObject({ title: 1, notes: 3 });
  });

  it("requires the wing only when the society has wings", () => {
    expect(mapHeaders("flats", ["Flat"], ctx).missing).toEqual(["Wing"]);
    expect(mapHeaders("flats", ["Flat"], { ...ctx, hasWings: false }).missing).toEqual([]);
    expect(mapHeaders("dues", ["Flat", "Month", "Amount"], ctx).missing).toEqual([]);
  });
});

describe("validateTable", () => {
  it("stops on missing columns or an empty file", () => {
    expect(check("dues", "Flat,Amount\n101,100").errors).toEqual([{ line: 1, message: "Missing column: Month" }]);
    expect(check("dues", "Flat,Month,Amount").errors[0].message).toMatch(/no rows/);
  });

  it("reads flats, guessing floors and defaulting the maintenance start to this month", () => {
    const v = check("flats", "Wing,Flat,Monthly maintenance\nA,101,\"2,500\"\nA,G02,\nA,7,");
    expect(v.rows).toEqual([
      expect.objectContaining({ line: 2, wing: "A", flat: "101", floor: 1, maintenance: 2500, from: { month: 10, year: 2026 } }),
      expect.objectContaining({ line: 3, floor: 0, maintenance: null }),
    ]);
    expect(v.errors).toEqual([{ line: 4, message: "Can't tell the floor of flat 7; fill the Floor column" }]);
  });

  it("rejects the same flat twice", () => {
    const v = check("flats", "Wing,Floor,Flat\nA,1,101\na,1,101");
    expect(v.errors[0]).toEqual({ line: 3, message: "Flat 101 in wing a is listed twice (also line 2)" });
  });

  it("reads residents with owner/tenant, primary and committee role", () => {
    const v = check("residents", "Name,Email,Mobile,Flat,Type,Primary,Role\nRavi,RAVI@X.COM,098765 43210,101,Tenant,yes,Treasurer\nIyer,iyer@x.com,123,102,,,");
    expect(v.rows[0]).toMatchObject({ email: "ravi@x.com", phone: "+919876543210", type: "TENANT", primary: true, role: "TREASURER", wing: null });
    expect(v.rows[1]).toMatchObject({ type: "OWNER", primary: false, role: null, phone: null });
    expect(v.warnings).toContainEqual({ line: 3, message: 'Mobile "123" is not a 10-digit Indian number; left blank' });
  });

  it("rejects bad resident rows", () => {
    const v = check("residents", "Name,Email,Flat,Type,Role\nR,r@x.com,101,,\nRavi,not-an-email,101,,\nRavi,r@x.com,101,landlady,\nRavi,r@x.com,101,,chairman");
    expect(v.errors.map((e) => e.line)).toEqual([2, 3, 4, 5]);
    expect(v.rows).toEqual([]);
  });

  it("reads dues with part payments and other charges", () => {
    const v = check("dues", "Flat,Month,Amount,Paid,Charge,Paid on\n101,Sep 2026,2500,1000,,12/09/2026\n101,Sep 2026,5000,,Sinking fund,");
    expect(v.rows).toEqual([
      expect.objectContaining({ month: 9, year: 2026, amount: 2500, paid: 1000, label: "Maintenance", paidOn: new Date(Date.UTC(2026, 8, 12)) }),
      expect.objectContaining({ amount: 5000, paid: 0, label: "Sinking fund" }),
    ]);
  });

  it("rejects future months, overpayments and duplicates in dues", () => {
    const v = check("dues", "Flat,Month,Amount,Paid\n101,Nov 2026,100,\n101,Oct 2026,100,150\n101,Sep 2026,100,\n101,sep 2026,90,");
    expect(v.errors.map((e) => e.line)).toEqual([2, 3, 5]);
    expect(v.errors[0].message).toMatch(/future/);
    expect(v.errors[1].message).toMatch(/more than the amount/);
  });

  it("reads expenses, matching known categories and reading the payment mode", () => {
    const v = check("expenses", "Date,Particulars,Amount,Head,Mode\n05/09/2026,Light bill,4820,electricity,UPI\n06/09/2026,Tea,120,Refreshments,cash");
    expect(v.rows).toEqual([
      expect.objectContaining({ title: "Light bill", amount: 4820, category: "Electricity", channel: "BANK" }),
      expect.objectContaining({ category: "Refreshments", channel: "CASH" }),
    ]);
  });

  it("rejects future expense dates", () => {
    expect(check("expenses", "Date,Title,Amount\n30/10/2026,Paint,100").errors[0].message).toBe("Date is in the future");
  });
});

describe("chargeKeyFor", () => {
  it("uses the monthly maintenance key for maintenance and a stable key for other charges", () => {
    expect(chargeKeyFor("")).toBe("MAINTENANCE");
    expect(chargeKeyFor(" Maintenance ")).toBe("MAINTENANCE");
    expect(chargeKeyFor("Sinking  Fund")).toBe("IMPORT:sinking fund");
  });
});
