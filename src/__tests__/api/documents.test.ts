import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/queries/documents", () => ({ getDocumentForViewer: vi.fn() }));
vi.mock("@/lib/storage", () => {
  class StorageNotConfiguredError extends Error {}
  return { StorageNotConfiguredError, signDownload: vi.fn().mockResolvedValue("https://r2.example/get?sig=1") };
});

import { GET } from "@/app/api/documents/[id]/route";
import { getSession } from "@/lib/session";
import { getDocumentForViewer } from "@/lib/queries/documents";
import { signDownload } from "@/lib/storage";

const call = (url = "http://localhost/api/documents/d1") => GET(new NextRequest(url), { params: Promise.resolve({ id: "d1" }) });

describe("GET /api/documents/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({ user: { id: "u1", role: "OWNER", societyId: "s1" } } as never);
    vi.mocked(getDocumentForViewer).mockResolvedValue({ id: "d1", storageKey: "k", fileName: "a.pdf", mimeType: "application/pdf" } as never);
  });

  it("looks the document up with the session's society and role", async () => {
    await call();
    expect(getDocumentForViewer).toHaveBeenCalledWith("s1", "OWNER", "d1");
  });

  it("redirects to a short-lived signed link, never cached", async () => {
    const res = await call();
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://r2.example/get?sig=1");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(signDownload).toHaveBeenCalledWith("k", { fileName: "a.pdf", contentType: "application/pdf", attachment: false });
  });

  it("supports forced download", async () => {
    await call("http://localhost/api/documents/d1?download=1");
    expect(vi.mocked(signDownload).mock.calls[0][1].attachment).toBe(true);
  });

  it("404s a document the viewer may not open (other society or committee-only)", async () => {
    vi.mocked(getDocumentForViewer).mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    expect(signDownload).not.toHaveBeenCalled();
  });

  it("404s a user without a society", async () => {
    vi.mocked(getSession).mockResolvedValue({ user: { id: "x", role: "SUPER_ADMIN", societyId: null } } as never);
    expect((await call()).status).toBe(404);
    expect(getDocumentForViewer).not.toHaveBeenCalled();
  });
});
