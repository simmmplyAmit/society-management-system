/** UPI/bank references: 8–22 letters or digits (UPI UTRs are 12 digits). Returns uppercase or null. */
export function normalizeUtr(input: string): string | null {
  const v = input.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z0-9]{8,22}$/.test(v) ? v : null;
}
