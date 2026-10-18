/**
 * Normalizes an Indian mobile number to E.164 (+91XXXXXXXXXX).
 * Accepts 10 digits starting 6-9, optionally prefixed with 0, 91 or +91.
 * Returns null for anything else.
 */
export function normalizePhone(input: string): string | null {
  const compact = input.replace(/[\s\-().]/g, "");
  const m = /^(?:\+91|91|0)?([6-9]\d{9})$/.exec(compact);
  return m ? `+91${m[1]}` : null;
}

export function maskPhone(phone: string): string {
  return phone.replace(/^(\+91)(\d{2})\d{6}(\d{2})$/, "$1 $2••••••$3");
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const shown = local.slice(0, Math.min(2, local.length));
  return `${shown}${"•".repeat(Math.max(local.length - shown.length, 1))}@${domain}`;
}
