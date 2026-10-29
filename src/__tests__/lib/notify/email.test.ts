import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatFrom, sendEmail } from "@/lib/notify/email";

describe("formatFrom", () => {
  it("keeps the verified address and puts the society in the display name", () => {
    expect(formatFrom("Society MS <no-reply@notify.example.in>", "Shanti Niwas CHS")).toBe('"Shanti Niwas CHS via Society MS" <no-reply@notify.example.in>');
    expect(formatFrom('"Society MS" <no-reply@x.in>', "A")).toBe('"A via Society MS" <no-reply@x.in>');
    expect(formatFrom("no-reply@x.in", "Shanti")).toBe('"Shanti" <no-reply@x.in>');
  });

  it("falls back to EMAIL_FROM unchanged without a society", () => {
    expect(formatFrom("Society MS <no-reply@x.in>")).toBe("Society MS <no-reply@x.in>");
    expect(formatFrom("Society MS <no-reply@x.in>", "  ")).toBe("Society MS <no-reply@x.in>");
  });

  it("strips characters that could break or inject header syntax", () => {
    expect(formatFrom("B <n@x.in>", 'Evil" <a@b.c>\r\nBcc: x@y.z')).toBe('"Evil a@b.c Bcc: x@y.z via B" <n@x.in>');
  });
});

describe("sendEmail", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "Society MS <no-reply@x.in>");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset().mockResolvedValue({ ok: true });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const sent = () => JSON.parse(fetchMock.mock.calls[0][1].body as string);

  it("sends as the society with replies to its committee", async () => {
    await sendEmail({ to: "r@x.com", subject: "S", html: "<p>h</p>", text: "h", fromName: "Shanti", replyTo: ["t@x.com"] });
    expect(sent()).toEqual({ from: '"Shanti via Society MS" <no-reply@x.in>', to: ["r@x.com"], reply_to: ["t@x.com"], subject: "S", html: "<p>h</p>", text: "h" });
  });

  it("omits reply_to when there is none (OTPs, security alerts)", async () => {
    await sendEmail({ to: "r@x.com", subject: "S", html: "h", text: "h" });
    expect(sent()).not.toHaveProperty("reply_to");
    expect(sent().from).toBe("Society MS <no-reply@x.in>");
  });
});
