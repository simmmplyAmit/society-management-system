import { NextRequest, NextResponse } from "next/server";
import { generateAllSocietiesCurrentMonth } from "@/lib/queries/maintenance";
import { sendNewDueNotices, sendScheduledReminders } from "@/lib/notify/schedule";

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
    // Messaging problems are reported but never fail the dues generation above
    const notices = await sendNewDueNotices().catch((e) => {
      console.error("[cron] due notices failed", e);
      return null;
    });
    const reminders = await sendScheduledReminders().catch((e) => {
      console.error("[cron] reminders failed", e);
      return null;
    });
    return NextResponse.json({ ok: true, ...result, notices, reminders });
  } catch (err) {
    console.error("[cron/generate-maintenance]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
