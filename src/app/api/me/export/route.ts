import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getMyData } from "@/lib/queries/my-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Download a copy of your own personal data as a JSON file. Only ever returns the caller's data. */
export async function GET() {
  const session = await getSession();
  const { id: userId, societyId } = session.user;
  if (!societyId) return NextResponse.json({ error: "Not available for this account" }, { status: 404 });

  const data = await getMyData(societyId, userId);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="my-data.json"',
      "Cache-Control": "no-store",
    },
  });
}
