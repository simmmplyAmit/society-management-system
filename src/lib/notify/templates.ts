import type { SmsTemplate } from "./sms";

export interface Rendered {
  email: { subject: string; html: string; text: string };
  sms: { template: SmsTemplate; vars: Record<string, string>; preview: string };
}

export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(societyName: string, heading: string, body: string): string {
  return `<div style="font-family:Inter,Arial,sans-serif;background:#f5f6fa;padding:24px">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7ef">
<p style="margin:0 0 4px;color:#6b7280;font-size:13px">${escapeHtml(societyName)}</p>
<h2 style="margin:0 0 16px;font-size:20px;color:#111827">${escapeHtml(heading)}</h2>
${body}
</div></div>`;
}

export function otpMessage(code: string, reason: string): Rendered {
  const text = `Your Society MS code is ${code}. It is valid for 10 minutes. Do not share it with anyone.`;
  return {
    email: {
      subject: `${code} is your Society MS code`,
      text: `${reason}\n\n${text}`,
      html: shell(
        "Society MS",
        reason,
        `<p style="font-size:14px;color:#374151">Use this code to continue. It is valid for 10 minutes.</p>
<p style="font-size:32px;letter-spacing:6px;font-weight:700;color:#4f46e5;margin:16px 0">${escapeHtml(code)}</p>
<p style="font-size:12px;color:#6b7280">If you did not request this, you can ignore this email. Never share this code.</p>`
      ),
    },
    sms: { template: "otp", vars: { otp: code }, preview: text },
  };
}

export interface DueInfo {
  name: string;
  societyName: string;
  flat: string;
  period: string; // e.g. "October 2026"
  amount: string; // formatted, e.g. "₹2,500"
  upiId?: string | null;
  paidOn?: string;
  utr?: string | null;
}

export function dueMessage(info: DueInfo, reminder: boolean): Rendered {
  const upi = info.upiId ?? "-";
  const subject = reminder
    ? `Reminder: maintenance ${info.amount} for ${info.period} is pending`
    : `Maintenance due: ${info.amount} for ${info.period}`;
  const pay = info.upiId ? `Pay by UPI to ${info.upiId}.` : "Please pay as per your society's instructions.";
  const text = `Hi ${info.name}, ${reminder ? "a reminder that " : ""}maintenance of ${info.amount} for ${info.period} (${info.flat}) is pending. ${pay} Open ${appUrl()}/dashboard/maintenance to see your dues.`;
  return {
    email: {
      subject,
      text,
      html: shell(
        info.societyName,
        reminder ? "Maintenance reminder" : "Maintenance due",
        `<p style="font-size:14px;color:#374151">Hi ${escapeHtml(info.name)},</p>
<p style="font-size:14px;color:#374151">${reminder ? "This is a reminder that your" : "Your"} maintenance for <b>${escapeHtml(info.period)}</b> is pending.</p>
<table style="font-size:14px;margin:12px 0;color:#111827"><tr><td style="color:#6b7280;padding-right:16px">Flat</td><td>${escapeHtml(info.flat)}</td></tr>
<tr><td style="color:#6b7280;padding-right:16px">Amount</td><td><b>${escapeHtml(info.amount)}</b></td></tr>
${info.upiId ? `<tr><td style="color:#6b7280;padding-right:16px">Pay to UPI</td><td>${escapeHtml(info.upiId)}</td></tr>` : ""}</table>
<a href="${appUrl()}/dashboard/maintenance" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600">View dues</a>`
      ),
    },
    sms: {
      template: "due",
      vars: { name: info.name, amount: info.amount, period: info.period, flat: info.flat, upi },
      preview: text,
    },
  };
}

export function receiptMessage(info: DueInfo): Rendered {
  const text = `Hi ${info.name}, we received ${info.amount} maintenance for ${info.period} (${info.flat}) on ${info.paidOn ?? "today"}${info.utr ? `, ref ${info.utr}` : ""}. Thank you! - ${info.societyName}`;
  return {
    email: {
      subject: `Payment received: ${info.amount} for ${info.period}`,
      text,
      html: shell(
        info.societyName,
        "Payment received",
        `<p style="font-size:14px;color:#374151">Hi ${escapeHtml(info.name)}, thank you! We have recorded your maintenance payment.</p>
<table style="font-size:14px;margin:12px 0;color:#111827"><tr><td style="color:#6b7280;padding-right:16px">Flat</td><td>${escapeHtml(info.flat)}</td></tr>
<tr><td style="color:#6b7280;padding-right:16px">Period</td><td>${escapeHtml(info.period)}</td></tr>
<tr><td style="color:#6b7280;padding-right:16px">Amount</td><td><b>${escapeHtml(info.amount)}</b></td></tr>
<tr><td style="color:#6b7280;padding-right:16px">Paid on</td><td>${escapeHtml(info.paidOn ?? "-")}</td></tr>
${info.utr ? `<tr><td style="color:#6b7280;padding-right:16px">Reference</td><td>${escapeHtml(info.utr)}</td></tr>` : ""}</table>`
      ),
    },
    sms: {
      template: "receipt",
      vars: { name: info.name, amount: info.amount, period: info.period, flat: info.flat },
      preview: text,
    },
  };
}
