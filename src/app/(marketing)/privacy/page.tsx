import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/marketing/legal-page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE.brand} collects, uses and protects personal data.`,
};

export default function PrivacyPage() {
  const b = SITE.brand;
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p>
          This policy explains what personal data {b} (operated by {SITE.legalName}, “we”, “us”)
          handles, why, and the choices you have. It is written to meet the Digital Personal Data
          Protection Act, 2023 and the Information Technology Act, 2000 and their rules.
        </p>
      }
    >
      <LegalSection title="1. Who is responsible for your data">
        <p>
          {b} is software that housing societies use to run their accounts and communication.
          When your society adds you to {b}, <strong>your society is the Data Fiduciary</strong>{" "}
          for your data: it decides what is recorded about you and why. We act as its{" "}
          <strong>Data Processor</strong> and handle that data only to provide the service to the
          society.
        </p>
        <p>
          We are the Data Fiduciary for data we collect for our own business, such as the contact
          details of a committee member who signs their society up, requests a demo or pays our
          invoice.
        </p>
      </LegalSection>

      <LegalSection title="2. What we collect">
        <ul>
          <li>
            <strong>Account details:</strong> name, email address, mobile number, role in the
            society (for example admin, treasurer, owner or tenant) and a password, which is stored
            only as a one-way hash.
          </li>
          <li>
            <strong>Flat details:</strong> the flats you are linked to as an owner or tenant, and
            flat information the society records (wing, floor, configuration, area).
          </li>
          <li>
            <strong>Dues and payments:</strong> maintenance and other charges, amounts paid, UPI
            transaction (UTR) numbers you report, screenshots you attach as payment proof, cash
            receipts, credit balances and bank deposit references. We do not collect card numbers,
            UPI PINs or bank login details.
          </li>
          <li>
            <strong>Society records:</strong> expenses, income, bank balance checks and documents
            uploaded by the committee, which can include names of members and vendors.
          </li>
          <li>
            <strong>Content you post:</strong> notices, community posts and comments, complaints,
            replies and photos.
          </li>
          <li>
            <strong>Verification and security data:</strong> one-time passcodes (stored only in
            hashed form and expiring after 10 minutes), login attempts, and a record of messages
            sent to you.
          </li>
          <li>
            <strong>Technical data:</strong> basic logs kept by our hosting providers (such as IP
            address, browser type and time of request) to keep the service running and secure.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How we use it">
        <ul>
          <li>To provide the service your society has signed up for: raising dues, recording payments, showing balances, notices and complaints to the right people.</li>
          <li>To verify your email and mobile number and to keep your account secure.</li>
          <li>To send you messages about your society: new dues, payment reminders, receipts, notices, complaint updates and security alerts such as changes to the society’s UPI ID.</li>
          <li>To prevent fraud and misuse, and to investigate problems.</li>
          <li>To meet legal obligations, such as keeping financial and tax records.</li>
        </ul>
        <p>
          We do <strong>not</strong> sell personal data, use it for advertising, or share it with
          other societies. We do not use advertising or tracking cookies.
        </p>
      </LegalSection>

      <LegalSection title="4. Who can see your data">
        <ul>
          <li>
            <strong>Inside your society,</strong> access depends on role. Committee members (admin,
            secretary, treasurer) can see residents’ details and the society’s accounts. Owners and
            tenants see the dues of the flats they are linked to, notices, community posts and
            their own complaints. Internal committee notes are never shown to residents.
          </li>
          <li>
            <strong>Our service providers,</strong> who process data on our behalf under contract:
            cloud hosting (Vercel), database hosting (Neon), file storage (Cloudflare R2), email
            delivery (Resend) and SMS delivery (MSG91). They may store or process data outside
            India, in countries the Government of India has not restricted.
          </li>
          <li>
            <strong>Authorities,</strong> when the law requires it, for example under a court order
            or a lawful request from a government agency.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Payments">
        <p>
          Residents pay their society directly through the society’s UPI ID or bank account. {b}{" "}
          does not receive, hold or transfer the society’s money and is not a payment service. Any
          payment you make is processed by your bank or UPI app under its own privacy policy.
        </p>
      </LegalSection>

      <LegalSection title="6. How long we keep data">
        <ul>
          <li>Account data is kept while you are a member of a society that uses {b}. When the society deactivates your account you can no longer sign in, but records linked to you are kept as part of the society’s history.</li>
          <li>Financial records (dues, payments, credit entries, cash receipts, expenses and income) are never edited or deleted while the society uses the service, so its accounts stay complete and auditable.</li>
          <li>Documents marked as tax receipts or audit reports are kept for 8 years. A deleted document is removed from storage 30 days after deletion.</li>
          <li>Unconfirmed uploads are removed within a day; one-time passcodes expire after 10 minutes.</li>
          <li>When a society stops using {b}, we give it an export of its data on request and delete the society’s data within 90 days after the end of the subscription, except what we must keep by law.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Security">
        <p>
          Data is sent over encrypted connections (HTTPS). Passwords and passcodes are stored only
          as hashes. Each society’s data is kept separate, and every request is checked against the
          user’s society and role. Documents are kept in private storage and opened only through
          short-lived links after an access check. Sensitive changes, such as the society’s UPI ID,
          need approval from a second committee member.
        </p>
        <p>
          No system is perfectly secure. If a personal data breach occurs, we will inform the
          affected society and, where the law requires, the Data Protection Board of India and the
          people affected.
        </p>
      </LegalSection>

      <LegalSection title="8. Your rights">
        <p>Under the Digital Personal Data Protection Act, 2023 you can:</p>
        <ul>
          <li>ask for a summary of the personal data held about you and who it has been shared with;</li>
          <li>ask for inaccurate or incomplete data to be corrected or updated;</li>
          <li>ask for data to be erased when it is no longer needed, subject to records the society or we must keep by law;</li>
          <li>withdraw consent where processing is based on consent;</li>
          <li>nominate another person to exercise these rights if you die or become unable to; and</li>
          <li>raise a grievance and get a response.</li>
        </ul>
        <p>
          Because your society controls your data, please contact your society’s committee first.
          You can also write to our Grievance Officer (below), and we will work with your society
          to respond. If you are not satisfied with the response, you may complain to the Data
          Protection Board of India.
        </p>
      </LegalSection>

      <LegalSection title="9. Children">
        <p>
          {b} is meant for adult members of housing societies. Societies should not add accounts
          for children under 18.
        </p>
      </LegalSection>

      <LegalSection title="10. Cookies">
        <p>
          We use only the cookies needed to keep you signed in and to protect sign-in forms. We do
          not use analytics, advertising or third-party tracking cookies.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes to this policy">
        <p>
          We will post any change on this page and update the date at the top. For significant
          changes we will also notify society admins by email before they take effect.
        </p>
      </LegalSection>

      <LegalSection id="grievance" title="12. Contact and Grievance Officer">
        <p>
          Grievance Officer: {SITE.grievanceOfficer.name}
          <br />
          Email: <a href={`mailto:${SITE.grievanceOfficer.email}`}>{SITE.grievanceOfficer.email}</a>
          <br />
          {SITE.legalName}, {SITE.address}
        </p>
        <p>
          We acknowledge grievances within 72 hours and aim to resolve them within 30 days. For
          other questions, see our <Link href="/contact">Contact page</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
