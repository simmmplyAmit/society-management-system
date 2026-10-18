const UPI_ID_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;

export function isValidUpiId(upiId: string | null | undefined): upiId is string {
  return !!upiId && UPI_ID_RE.test(upiId.trim());
}

interface UpiLinkInput {
  upiId: string | null | undefined;
  payeeName?: string | null;
  amount?: number | string | null;
  note?: string | null;
}

/** Builds a upi://pay deep link (opens any UPI app on mobile). Null if the UPI ID is invalid. */
export function buildUpiLink({ upiId, payeeName, amount, note }: UpiLinkInput): string | null {
  if (!isValidUpiId(upiId)) return null;
  const params: [string, string][] = [["pa", upiId.trim()]];
  if (payeeName) params.push(["pn", payeeName]);
  const amt = Number(amount);
  if (amount != null && Number.isFinite(amt) && amt > 0) params.push(["am", amt.toFixed(2)]);
  params.push(["cu", "INR"]);
  if (note) params.push(["tn", note]);
  return "upi://pay?" + params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
}
