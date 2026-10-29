import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/queries/my-data", () => ({ getMyData: vi.fn().mockResolvedValue({ profile: { name: "Asha" } }) }));

import { GET } from "@/app/api/me/export/route";
import { getSession } from "@/lib/session";
import { getMyData } from "@/lib/queries/my-data";

describe("GET /api/me/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({ user: { id: "u1", role: "OWNER", societyId: "s1" } } as never);
  });

  it("returns only the signed-in person's data as a download that is never cached", async () => {
    const res = await GET();
    expect(getMyData).toHaveBeenCalledWith("s1", "u1");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(JSON.parse(await res.text())).toEqual({ profile: { name: "Asha" } });
  });

  it("is not available to accounts without a society", async () => {
    vi.mocked(getSession).mockResolvedValue({ user: { id: "x", role: "SUPER_ADMIN", societyId: null } } as never);
    expect((await GET()).status).toBe(404);
    expect(getMyData).not.toHaveBeenCalled();
  });
});
