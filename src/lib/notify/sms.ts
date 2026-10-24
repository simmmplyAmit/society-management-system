import type { SendResult } from "./email";

/**
 * India requires DLT-registered templates for SMS. Each logical template maps to a
 * MSG91 template id; the variable names in `vars` must match the ##variables## in
 * the approved template text (see .env.example).
 */
export type SmsTemplate = "otp" | "due" | "receipt";

const TEMPLATE_ENV: Record<SmsTemplate, string> = {
  otp: "MSG91_TEMPLATE_OTP",
  due: "MSG91_TEMPLATE_DUE",
  receipt: "MSG91_TEMPLATE_RECEIPT",
};

export interface SmsMessage {
  to: string; // E.164, e.g. +919876543210
  template: SmsTemplate;
  vars: Record<string, string>;
  /** Human-readable text, used only for dev logging. */
  preview: string;
}

export function smsConfigured(template: SmsTemplate): boolean {
  return Boolean(process.env.MSG91_AUTH_KEY && process.env[TEMPLATE_ENV[template]]);
}

export async function sendSms(msg: SmsMessage): Promise<SendResult> {
  if (!smsConfigured(msg.template)) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "SMS is not configured" };
    }
    console.log(`[sms:dev] to=${msg.to} template=${msg.template}\n${msg.preview}`);
    return { ok: true, dev: true };
  }

  try {
    const res = await fetch("https://control.msg91.com/api/v5/flow", {
      method: "POST",
      headers: {
        authkey: process.env.MSG91_AUTH_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_id: process.env[TEMPLATE_ENV[msg.template]],
        short_url: "0",
        recipients: [{ mobiles: msg.to.replace(/^\+/, ""), ...msg.vars }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.text();
    if (!res.ok) return { ok: false, error: `MSG91 ${res.status}: ${body.slice(0, 200)}` };
    // MSG91 answers 200 with {"type":"error",...} for rejected requests
    if (/"type"\s*:\s*"error"/i.test(body)) return { ok: false, error: `MSG91: ${body.slice(0, 200)}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "SMS send failed" };
  }
}
