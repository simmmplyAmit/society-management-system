import { describe, it, expect } from "vitest";
import { complaintMessage, dueMessage, expenseCreditMessage, noticeMessage, otpMessage, receiptMessage } from "@/lib/notify/templates";

const info = {
  name: "Ravi", societyName: "Shanti Niwas", flat: "विंग A · मंज़िल 1 · 102", period: "अक्टूबर 2026", amount: "₹2,500", upiId: "shanti@okaxis",
};

describe("emails in Hindi and Marathi", () => {
  it("writes dues and reminders in Hindi, keeping the SMS in English", () => {
    const m = dueMessage(info, false, "hi");
    expect(m.email.subject).toBe("अक्टूबर 2026 का मेंटेनेंस बकाया: ₹2,500");
    expect(m.email.html).toContain("नमस्ते Ravi,");
    expect(m.email.html).toContain("shanti@okaxis");
    expect(dueMessage(info, true, "hi").email.subject).toMatch(/^याद दिलाना:/);
    expect(m.sms).toEqual(dueMessage(info, false).sms);
    expect(m.sms.preview).toMatch(/^Hi Ravi/);
  });

  it("uses a charge's own name instead of the word maintenance", () => {
    expect(dueMessage({ ...info, label: "Sinking fund" }, false, "mr").email.subject).toBe("अक्टूबर 2026 चा Sinking fund थकबाकी: ₹2,500");
  });

  it("escapes names in the localised HTML too", () => {
    const m = dueMessage({ ...info, name: "<img src=x>", societyName: "A&B" }, false, "mr");
    expect(m.email.html).not.toContain("<img");
    expect(m.email.html).toContain("&lt;img src=x&gt;");
    expect(m.email.html).toContain("A&amp;B");
  });

  it("writes receipts, credit, notices and codes in Marathi", () => {
    expect(receiptMessage({ ...info, paidOn: "05 ऑक्टो, 2026", utr: "UTR9" }, "mr").email.text).toContain("रेफरन्स UTR9");
    expect(expenseCreditMessage({ societyName: "S", name: "Asha", amount: "₹600", expenseTitle: "Lift" }, "mr").subject).toBe("“Lift” साठी ₹600 क्रेडिट केले");
    expect(noticeMessage({ societyName: "S", title: "Water cut", body: "Tomorrow", categoryLabel: "आपत्कालीन", emergency: true }, "mr").subject).toBe("तातडीचे: Water cut - S");
    const otp = otpMessage("123456", "Reset your password", "mr");
    expect(otp.email.subject).toBe("123456 हा तुमचा Society MS कोड आहे");
    expect(otp.email.html).toContain("तुमचा पासवर्ड बदला");
    expect(otp.sms).toEqual(otpMessage("123456", "Reset your password").sms);
  });

  it("phrases a complaint's new status in the recipient's language", () => {
    const m = complaintMessage(
      { societyName: "S", complaintId: "c1", title: "Leak", kind: "status", actorName: "Meera", detail: "Status: Resolved. Fixed", toCommittee: false, statusLabel: "हल हुई", note: "Fixed" },
      "hi"
    );
    expect(m.text).toContain("स्थिति: हल हुई। Fixed");
    expect(m.subject).toBe("आपकी शिकायत में बदलाव हुआ: Leak");
  });

  it("keeps English unchanged when no language or English is given", () => {
    expect(dueMessage(info, false).email).toEqual(dueMessage(info, false, "en").email);
    expect(dueMessage(info, false, "fr").email.subject).toMatch(/^Maintenance due:/);
  });
});
