export type SendResult = { ok: true; dev?: boolean } | { ok: false; error: string };

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/**
 * Sends through Resend. Without RESEND_API_KEY/EMAIL_FROM, non-production runs
 * log the message to the console instead; production reports a failure.
 */
export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  if (!emailConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "Email is not configured" };
    }
    console.log(`[email:dev] to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
    return { ok: true, dev: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Email send failed" };
  }
}
