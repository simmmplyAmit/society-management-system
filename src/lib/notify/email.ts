export type SendResult = { ok: true; dev?: boolean } | { ok: false; error: string };

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Society shown as the sender, e.g. "Shanti Niwas CHS via Society MS". The address stays EMAIL_FROM's. */
  fromName?: string;
  /** Where replies go (the society's committee), so residents' answers never land in a no-reply box. */
  replyTo?: string[];
}

/**
 * Builds the From header: one verified address for every society, with the society in the
 * display name. EMAIL_FROM is "Brand <address>" or a bare address.
 */
export function formatFrom(emailFrom: string, fromName?: string): string {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(emailFrom);
  const brand = m?.[1].trim() ?? "";
  const address = (m?.[2] ?? emailFrom).trim();
  // Display names are quoted; strip characters that could break or inject header syntax
  const clean = (fromName ?? "").replace(/["\\<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (!clean) return emailFrom;
  return `"${brand ? `${clean} via ${brand}` : clean}" <${address}>`;
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
    const extra = `${msg.fromName ? ` from="${msg.fromName}"` : ""}${msg.replyTo?.length ? ` reply-to=${msg.replyTo.join(",")}` : ""}`;
    console.log(`[email:dev] to=${msg.to}${extra} subject="${msg.subject}"\n${msg.text}`);
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
        from: formatFrom(process.env.EMAIL_FROM!, msg.fromName),
        to: [msg.to],
        ...(msg.replyTo?.length ? { reply_to: msg.replyTo } : {}),
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
