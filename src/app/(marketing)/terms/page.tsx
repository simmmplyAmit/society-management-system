import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/marketing/legal-page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms that apply to societies and members using ${SITE.brand}.`,
};

export default function TermsPage() {
  const b = SITE.brand;
  return (
    <LegalPage
      title="Terms of Service"
      intro={
        <p>
          These terms are an agreement between {SITE.legalName} (“we”, “us”) and the housing
          society that signs up for {b} (the “Society”), and they also apply to every person who
          uses {b} through a Society (“you”). By creating or using an account you accept them.
        </p>
      }
    >
      <LegalSection title="1. The service">
        <p>
          {b} is web software for running a housing society: flats and residents, maintenance and
          other dues, payment records, cash receipts, expenses, income, bank balance checks,
          documents, notices, a community board and complaints. We may improve, change or remove
          features over time; we will give Society admins reasonable notice before removing a
          feature they rely on.
        </p>
      </LegalSection>

      <LegalSection title="2. What we are not">
        <ul>
          <li>
            <strong>Not a payment service.</strong> Residents pay the Society directly through its
            own UPI ID or bank account. We never receive, hold or transfer the Society’s money, and
            we are not responsible for payments sent to a wrong or outdated UPI ID or account.
          </li>
          <li>
            <strong>Not accounting, tax or legal advice.</strong> Reports and statements are tools
            to help the committee. The Society remains responsible for its books, audits, tax
            filings and compliance with the laws that apply to it (for example its state’s
            co-operative societies or apartment ownership laws and its bylaws).
          </li>
          <li>
            <strong>Not a guarantee of payment verification.</strong> Payments reported by residents
            are confirmed by the Society’s committee. We do not check bank or UPI records.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Accounts and the Society’s responsibilities">
        <ul>
          <li>The Society appoints its admins, who manage its account, add members and assign roles. The Society is responsible for what its admins and members do in {b}.</li>
          <li>The Society must have a lawful basis, and where required consent, to add residents’ personal data, and must keep it accurate. See our <Link href="/privacy">Privacy Policy</Link>.</li>
          <li>Keep your password and one-time passcodes private. Tell the Society admin and us promptly if you think your account has been misused.</li>
          <li>The Society should keep at least two active committee members with admin or treasurer access, so approvals and account recovery are possible when one person is unavailable.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>post anything unlawful, defamatory, abusive, obscene or that invades someone’s privacy;</li>
          <li>record false payments or entries, or use {b} to mislead members about the Society’s money;</li>
          <li>access another Society’s data or another person’s account, or try to get around security checks;</li>
          <li>upload malware, scrape the service, or overload it; or</li>
          <li>resell or copy the service.</li>
        </ul>
        <p>
          We may remove content or suspend an account that breaks these rules, and will tell the
          Society admin why unless the law prevents it.
        </p>
      </LegalSection>

      <LegalSection title="5. Fees">
        <ul>
          <li>
            {SITE.pricing.perFlatMonthly === null
              ? `During our pilot programme the service is free. Before any charge starts we will tell Society admins the price in writing at least ${SITE.pricing.noticeDays} days in advance; the Society can stop using ${b} before then at no cost.`
              : `Fees are ₹${SITE.pricing.perFlatMonthly} per flat per month plus GST, unless a different price is agreed in writing.`}
          </li>
          <li>Fees are billed in advance, monthly or yearly, and are payable within 15 days of the invoice. Prices may change with at least {SITE.pricing.noticeDays} days’ written notice; the new price applies from the next billing period.</li>
          <li>If fees remain unpaid 15 days after a reminder, we may restrict the Society to read-only access until they are paid. We will not delete data for non-payment without the notice described in section 8.</li>
          <li>Refunds and cancellations are covered by our <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Your data">
        <p>
          The Society owns the data it and its members put into {b}. We use it only to provide and
          support the service, to keep it secure, and as described in the Privacy Policy. We act as
          the Society’s data processor and will help it respond to requests from its members under
          data protection law.
        </p>
        <p>
          Messages such as reminders and notices are sent on the Society’s behalf, by SMS and
          email, to the verified contact details of its members.
        </p>
      </LegalSection>

      <LegalSection title="7. Availability and support">
        <p>
          We work to keep {b} available and secure, but we do not promise it will be uninterrupted
          or error-free. Planned maintenance will be done at quiet hours where possible. Support is
          provided by email at <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>{" "}
          on working days.
        </p>
      </LegalSection>

      <LegalSection title="8. Cancellation and termination">
        <ul>
          <li>The Society can cancel at any time by writing to us from an admin’s email address. Cancellation takes effect at the end of the current billing period.</li>
          <li>We may end the service for a Society with 30 days’ written notice, or immediately if it seriously breaks these terms or the law.</li>
          <li>After cancellation or termination the Society can ask for an export of its data within 60 days. We delete the Society’s data within 90 days after the end of the service, except records we must keep by law.</li>
        </ul>
      </LegalSection>

      <LegalSection title="9. Limitation of liability">
        <p>
          To the extent the law allows: we are not liable for indirect or consequential loss, lost
          profits, or loss caused by incorrect entries made by the Society or its members, payments
          sent outside {b}, or actions of the Society’s committee. Our total liability for any
          claim relating to the service is limited to the fees the Society paid us in the 12 months
          before the claim arose (or ₹1,000 if no fees were paid).
        </p>
        <p>
          The Society agrees to compensate us for claims by its members or third parties that arise
          from the Society’s misuse of the service or its breach of these terms.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to these terms">
        <p>
          We may update these terms. We will post the new version here with a new date and email
          Society admins at least 30 days before a significant change takes effect. Continuing to
          use {b} after that means you accept the change.
        </p>
      </LegalSection>

      <LegalSection title="11. Law and disputes">
        <p>
          These terms are governed by the laws of India. Both sides will first try to settle a
          dispute by talking to each other in good faith for 30 days. If that fails, the courts at{" "}
          {SITE.jurisdictionCity} have exclusive jurisdiction.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          {SITE.legalName}, {SITE.address}
          <br />
          Email: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
