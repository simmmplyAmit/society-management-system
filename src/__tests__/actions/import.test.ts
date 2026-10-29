import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/queries/import", () => ({ runImport: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireRole: vi.fn() }));

import { applyImport, previewImport } from "@/actions/import";
import { requireRole } from "@/lib/session";
import { runImport } from "@/lib/queries/import";
import { revalidatePath } from "next/cache";

const fd = (f: Record<string, string>) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  return d;
};
const as = (role: string) => vi.mocked(requireRole).mockResolvedValue({ user: { id: "u1", role, societyId: "s1" } } as never);
const result = (applied: boolean) => ({ kind: "dues", rowCount: 1, errors: [], warnings: [], counts: { create: 1, update: 0, skip: 0 }, items: [], notes: [], applied });

beforeEach(() => {
  vi.clearAllMocks();
  as("ADMIN");
});

describe("import actions", () => {
  it("are limited to ADMIN and TREASURER", async () => {
    vi.mocked(runImport).mockResolvedValue(result(false) as never);
    await previewImport(fd({ kind: "dues", text: "x" }));
    expect(requireRole).toHaveBeenCalledWith(["ADMIN", "TREASURER"]);
  });

  it("passes the session's society and user, and only writes on apply", async () => {
    vi.mocked(runImport).mockResolvedValue(result(false) as never);
    await previewImport(fd({ kind: "dues", text: "Flat,Month,Amount", fileName: "a.csv" }));
    expect(runImport).toHaveBeenCalledWith({ kind: "dues", text: "Flat,Month,Amount", fileName: "a.csv", societyId: "s1", userId: "u1", apply: false });
    expect(revalidatePath).not.toHaveBeenCalled();

    vi.mocked(runImport).mockResolvedValue(result(true) as never);
    const r = await applyImport(fd({ kind: "dues", text: "Flat,Month,Amount" }));
    expect(r).toEqual({ success: true, result: result(true) });
    expect(vi.mocked(runImport).mock.calls[1][0]).toMatchObject({ apply: true, societyId: "s1" });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/maintenance");
  });

  it("lets only admins import flats and residents", async () => {
    as("TREASURER");
    expect(await applyImport(fd({ kind: "residents", text: "x" }))).toEqual({ error: "Only an admin can import flats and residents" });
    expect(await applyImport(fd({ kind: "flats", text: "x" }))).toHaveProperty("error");
    expect(runImport).not.toHaveBeenCalled();
  });

  it("validates the kind and text", async () => {
    expect(await previewImport(fd({ kind: "users", text: "x" }))).toHaveProperty("error");
    expect(await previewImport(fd({ kind: "dues", text: "" }))).toEqual({ error: "Choose a file or paste your rows first" });
  });

  it("reports a failure without throwing", async () => {
    vi.mocked(runImport).mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await applyImport(fd({ kind: "dues", text: "x" }))).toEqual({ error: "The import could not be completed. Nothing was changed; please try again" });
  });
});
