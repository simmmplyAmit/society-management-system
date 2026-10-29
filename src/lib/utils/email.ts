// Emails are stored lowercase, but older accounts may have been saved with capitals, so every
// lookup by email ignores case. The database unique index is case-sensitive; checking with
// emailWhere before creating an account keeps "Ravi@x.com" and "ravi@x.com" from becoming two users.

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Prisma filter matching an email regardless of case or surrounding spaces. */
export function emailWhere(email: string) {
  return { email: { equals: normalizeEmail(email), mode: "insensitive" as const } };
}
