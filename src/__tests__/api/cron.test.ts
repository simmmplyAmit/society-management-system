import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/queries/maintenance", () => ({
  generateAllSocietiesCurrentMonth: vi.fn().mockResolvedValue({ month: 10, year: 2026, results: [], overdueMarked: 3 }),
}));

vi.mock("@/lib/queries/special-charges", () => ({ generateAllSpecialCharges: vi.fn().mockResolvedValue({ created: 7, missingArea: 1 }) }));
vi.mock("@/lib/credit-service", () => ({ applyCreditAllSocieties: vi.fn().mockResolvedValue(4) }));
vi.mock("@/lib/notify/schedule", () => ({
  sendNewDueNotices: vi.fn().mockResolvedValue({ sent: 1, failed: 0, skipped: 0 }),
  sendScheduledReminders: vi.fn().mockResolvedValue({ sent: 2, failed: 0, skipped: 0 }),
}));

import { GET } from "@/app/api/cron/generate-maintenance/route";
import { generateAllSocietiesCurrentMonth } from "@/lib/queries/maintenance";
import { sendNewDueNotices } from "@/lib/notify/schedule";
import { NextRequest } from "next/server";

const req = (auth?: string) =>
  new NextRequest("http://localhost/api/cron/generate-maintenance", { headers: auth ? { authorization: auth } : {} });

describe("GET /api/cron/generate-maintenance", () => {
  const original = process.env.CRON_SECRET;
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req("Bearer anything"));
    expect(res.status).toBe(401);
    expect(generateAllSocietiesCurrentMonth).not.toHaveBeenCalled();
  });

  it("rejects a missing or wrong bearer token", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    expect(generateAllSocietiesCurrentMonth).not.toHaveBeenCalled();
  });

  it("runs the job and returns the result for a valid token", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      overdueMarked: 3,
      specialCharges: { created: 7 },
      creditApplied: 4,
      notices: { sent: 1 },
      reminders: { sent: 2 },
    });
  });

  it("still succeeds when sending messages fails", async () => {
    process.env.CRON_SECRET = "s3cret";
    vi.mocked(sendNewDueNotices).mockRejectedValueOnce(new Error("provider down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, notices: null, reminders: { sent: 2 } });
  });

  it("returns 500 without leaking details when the job throws", async () => {
    process.env.CRON_SECRET = "s3cret";
    vi.mocked(generateAllSocietiesCurrentMonth).mockRejectedValueOnce(new Error("db password leaked"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/leaked/);
  });
});
