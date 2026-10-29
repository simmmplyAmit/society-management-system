"use server";

import { requireRole } from "@/lib/session";
import { runImport, type ImportResult } from "@/lib/queries/import";
import { IMPORT_KINDS, MAX_IMPORT_CHARS, type ImportKindKey } from "@/lib/import/kinds";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const importSchema = z.object({
  kind: z.enum(IMPORT_KINDS),
  text: z.string().min(1, "Choose a file or paste your rows first").max(MAX_IMPORT_CHARS, "The file is too large; split it into smaller files"),
  fileName: z.string().max(200).optional(),
});

/** Flats and residents shape the society, so only admins import them; treasurers can bring in past dues and expenses. */
const ADMIN_ONLY: ImportKindKey[] = ["flats", "residents"];

const PATHS: Record<ImportKindKey, string[]> = {
  flats: ["/dashboard/society", "/dashboard/maintenance"],
  residents: ["/dashboard/residents", "/dashboard/society"],
  dues: ["/dashboard/maintenance", "/dashboard"],
  expenses: ["/dashboard/expenses", "/dashboard/bank", "/dashboard/income"],
};

async function run(formData: FormData, apply: boolean): Promise<{ error: string } | { success: true; result: ImportResult }> {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId;
  if (!societyId) return { error: "No society found" };

  const parsed = importSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (ADMIN_ONLY.includes(parsed.data.kind) && session.user.role !== "ADMIN") {
    return { error: "Only an admin can import flats and residents" };
  }

  try {
    const result = await runImport({ ...parsed.data, societyId, userId: session.user.id, apply });
    if (result.applied) {
      for (const p of [...PATHS[parsed.data.kind], "/dashboard/import"]) revalidatePath(p);
    }
    return { success: true, result };
  } catch (err) {
    console.error("[import] failed:", err);
    return { error: "The import could not be completed. Nothing was changed; please try again" };
  }
}

/** Checks a file and returns what would happen to each row. Writes nothing. */
export async function previewImport(formData: FormData) {
  return run(formData, false);
}

/** Re-checks the file and imports it in one transaction, or not at all if any row has an error. */
export async function applyImport(formData: FormData) {
  return run(formData, true);
}
