import { NextRequest, NextResponse } from "next/server";
import { generateAllSocietiesCurrentMonth } from "@/lib/queries/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await generateAllSocietiesCurrentMonth();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/generate-maintenance]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
