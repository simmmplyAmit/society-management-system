import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/marketing/legal-page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description: `How cancellations and refunds work for ${SITE.brand} subscriptions.`,
};

export default function RefundPolicyPage() {
  const b = SITE.brand;
  return (
    <LegalPage
      title="Refund & Cancellation Policy"
      intro={
        <p>
          This policy covers the subscription fees a housing society pays {SITE.legalName} for{" "}
          {b}. It is part of our <Link href="/terms">Terms of Service</Link>.
        </p>
      }
    >
      <LegalSection title="1. Maintenance and other dues are not paid to us">
        <p>
          Residents pay maintenance, other charges and deposits <strong>directly to their society</strong>{" "}
          through the society’s UPI ID or bank account. {b} never receives that money, so we cannot
          refund or reverse it. For any refund or correction of dues, please contact your society’s
          committee or treasurer.
        </p>
      </LegalSection>

      <LegalSection title="2. Free pilot">
        <p>
          Societies in our pilot programme are not charged. We will give at least{" "}
          {SITE.pricing.noticeDays} days’ written notice before any fee starts, and a society can
          stop before then without paying anything.
        </p>
      </LegalSection>

      <LegalSection title="3. Cancelling a subscription">
        <ul>
          <li>A society admin can cancel at any time by emailing <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> from their registered email address.</li>
          <li>Cancellation takes effect at the end of the current billing period. The society keeps full access until then, and no further invoices are raised.</li>
          <li>The society can ask for an export of its data within 60 days of the end of the service.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Refunds">
        <ul>
          <li><strong>Monthly plans:</strong> fees for a month that has started are not refunded.</li>
          <li><strong>Yearly plans:</strong> cancelled within 14 days of payment, the full amount is refunded. After 14 days, the unused full months are refunded on a pro-rata basis.</li>
          <li><strong>Duplicate or wrong charges:</strong> any amount charged twice or in error is refunded in full.</li>
          <li><strong>If we end the service</strong> without the society being at fault, we refund fees paid for the period after the end date.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. How refunds are paid">
        <p>
          Approved refunds are paid to the original payment method or the society’s bank account
          within 7 working days of approval. Bank processing can take a few more days. GST is
          adjusted with a credit note where applicable.
        </p>
      </LegalSection>

      <LegalSection title="6. Contact">
        <p>
          For billing questions write to <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.
          <br />
          {SITE.legalName}, {SITE.address}
        </p>
      </LegalSection>
    </LegalPage>
  );
}
