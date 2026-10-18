import { describe, it, expect } from "vitest";
import { dueMessage, receiptMessage, otpMessage, escapeHtml } from "@/lib/notify/templates";

const info = {
  name: "Rahul", societyName: "Sunrise", flat: "Wing A · F1 · A-101",
  period: "October 2026", amount: "₹2,500", upiId: "sun@upi",
};

describe("templates", () => {
  it("escapes user-controlled values in HTML", () => {
    const m = dueMessage({ ...info, name: '<img src=x onerror="alert(1)">', societyName: "A&B <Soc>" }, false);
    expect(m.email.html).not.toContain("<img");
    expect(m.email.html).toContain("&lt;img");
    expect(m.email.html).toContain("A&amp;B &lt;Soc&gt;");
    expect(escapeHtml(`'"`)).toBe("&#39;&quot;");
  });

  it("builds a due notice and a reminder with the key facts", () => {
    const due = dueMessage(info, false);
    expect(due.email.subject).toBe("Maintenance due: ₹2,500 for October 2026");
    expect(due.sms).toMatchObject({ template: "due", vars: { name: "Rahul", amount: "₹2,500", period: "October 2026", upi: "sun@upi" } });
    expect(due.email.text).toContain("sun@upi");
    expect(dueMessage(info, true).email.subject).toMatch(/^Reminder:/);
  });

  it("handles a society without a UPI id", () => {
    const m = dueMessage({ ...info, upiId: null }, false);
    expect(m.sms.vars.upi).toBe("-");
    expect(m.email.html).not.toContain("Pay to UPI");
  });

  it("builds a receipt and an OTP message", () => {
    const r = receiptMessage({ ...info, paidOn: "05 Oct 2026", utr: "UTR9" });
    expect(r.sms.template).toBe("receipt");
    expect(r.email.text).toContain("UTR9");
    const o = otpMessage("123456", "Verify your email address");
    expect(o.sms).toMatchObject({ template: "otp", vars: { otp: "123456" } });
    expect(o.email.subject).toContain("123456");
  });
});
