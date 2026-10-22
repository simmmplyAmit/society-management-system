import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getDocumentForViewer } from "@/lib/queries/documents";
import { signDownload, StorageNotConfiguredError } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Checks who is asking, then redirects to a signed link that works for 60 seconds. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { societyId, role, id: userId } = session.user;
  if (!societyId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id } = await ctx.params;
  const doc = await getDocumentForViewer(societyId, role, userId, id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const url = await signDownload(doc.storageKey, {
      fileName: doc.fileName,
      contentType: doc.mimeType,
      attachment: req.nextUrl.searchParams.get("download") === "1",
    });
    const res = NextResponse.redirect(url, 302);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) {
      return NextResponse.json({ error: "File storage isn't set up" }, { status: 503 });
    }
    console.error("[documents download]", err);
    return NextResponse.json({ error: "Could not open the file" }, { status: 500 });
  }
}
