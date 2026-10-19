import { NextRequest, NextResponse } from "next/server";
import { generateAllSocietiesCurrentMonth } from "@/lib/queries/maintenance";
import { sendNewDueNotices, sendScheduledReminders } from "@/lib/notify/schedule";
import { applyCreditAllSocieties } from "@/lib/credit-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // sending many messages can exceed the default

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await generateAllSocietiesCurrentMonth();
    // Existing credit pays the new dues before anyone is told they owe money
    const creditApplied = await applyCreditAllSocieties().catch((e) => {
      console.error("[cron] credit apply failed", e);
      return null;
    });
    // Messaging problems are reported but never fail the dues generation above
    const notices = await sendNewDueNotices().catch((e) => {
      console.error("[cron] due notices failed", e);
      return null;
    });
    const reminders = await sendScheduledReminders().catch((e) => {
      console.error("[cron] reminders failed", e);
      return null;
    });
    return NextResponse.json({ ok: true, ...result, creditApplied, notices, reminders });
  } catch (err) {
    console.error("[cron/generate-maintenance]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
