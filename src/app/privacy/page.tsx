import Link from "next/link";
import type { Metadata } from "next";
import { BrandMark } from "@/components/layout/brand-mark";
import { PRIVACY_UPDATED, PRIVACY_VERSION, getPrivacyOperator } from "@/lib/privacy";

export const metadata: Metadata = { title: "Privacy Notice · Society MS" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const li = "ml-5 list-disc space-y-1";

export default function PrivacyPage() {
  const op = getPrivacyOperator();
  const contact = op.email ? (
    <a className="font-medium text-primary hover:underline" href={`mailto:${op.email}`}>{op.email}</a>
  ) : (
    <>your society committee</>
  );

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <BrandMark className="size-8" />
          <span className="text-sm font-semibold">Society MS</span>
          <Link href="/login" className="ml-auto text-sm text-primary hover:underline">Sign in</Link>
        </div>
      </header>

      <article className="mx-auto max-w-2xl space-y-7 px-4 py-8 text-sm leading-relaxed text-foreground/90">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Privacy Notice</h1>
          <p className="mt-1 text-muted-foreground">Last updated {PRIVACY_UPDATED} · version {PRIVACY_VERSION}</p>
          <p className="mt-3">
            Society MS helps housing societies manage residents, maintenance dues, expenses, notices and complaints. This notice
            explains in plain language what personal data is collected, why, who can see it, and what you can do about it.
          </p>
        </div>

        <Section title="1. Who is responsible for your data">
          <p>
            <b>Your society</b> (its committee) decides which residents, dues and records are kept in the app. <b>{op.name}</b>{" "}
            runs the software and keeps the data safe on the society&apos;s behalf. For questions or requests, write to {contact}.
          </p>
        </Section>

        <Section title="2. What we collect">
          <ul className={li}>
            <li><b>Account details:</b> your name, email address, mobile number, role (owner, tenant, committee) and a password, which is stored only as a one-way hash.</li>
            <li><b>Home details:</b> the flat(s) you are linked to and whether you own or rent.</li>
            <li><b>Money records:</b> maintenance dues and payments for your flat, UPI payment references (UTR) and screenshots you attach, cash receipts, and credit held in your account.</li>
            <li><b>Things you write or upload:</b> complaints and photos, community posts and comments, and documents the committee uploads.</li>
            <li><b>Technical data:</b> a sign-in session cookie, and basic server logs (time, address of the request, errors) used to keep the service secure.</li>
          </ul>
          <p>We do not collect your Aadhaar, PAN, bank account numbers, card details or precise location.</p>
        </Section>

        <Section title="3. Why we use it">
          <ul className={li}>
            <li>To run your society&apos;s accounts: raise dues, record and verify payments, send receipts and reminders.</li>
            <li>To confirm who you are (email and mobile verification, sign-in) and to protect the service from misuse.</li>
            <li>To send messages you need: dues, receipts, notices, complaint updates and one-time codes, by email or SMS.</li>
            <li>To let residents and the committee talk to each other (notices, complaints, community board).</li>
            <li>To keep records the law and audits require.</li>
          </ul>
          <p>We do not sell your data and we do not use it for advertising.</p>
        </Section>

        <Section title="4. Who can see what">
          <ul className={li}>
            <li><b>Committee (admin, secretary, treasurer):</b> resident names, contact details, dues, payment reports and your complaints. The treasurer and admin see payment records and proof you attach.</li>
            <li><b>Other residents:</b> your name on posts and comments you write on the community board, and documents or notices the committee shares with all residents. They cannot see your dues, payments or complaints.</li>
            <li><b>Complaints</b> are private between you and the committee. Committee-only notes are never shown to you.</li>
            <li><b>The platform team</b> can access data only as needed to run and support the service.</li>
          </ul>
        </Section>

        <Section title="5. Who we share it with">
          <p>We use trusted service providers to run the service. They process data only on our instructions:</p>
          <ul className={li}>
            <li>Vercel (hosting), Neon (database) and Cloudflare R2 (uploaded files)</li>
            <li>Resend (email) and MSG91 (SMS and one-time codes)</li>
          </ul>
          <p>
            Payments themselves happen between you and your society through your own UPI app. We never see your UPI PIN or bank
            login. We may disclose data if the law requires it.
          </p>
        </Section>

        <Section title="6. How we protect it">
          <ul className={li}>
            <li>All traffic is encrypted (HTTPS). Stored data is encrypted by our providers, and phone numbers and UPI IDs get an extra layer of encryption inside the app.</li>
            <li>Every society&apos;s data is kept separate, and what you can see depends on your role.</li>
            <li>Passwords are hashed, one-time codes expire quickly, and sign-in attempts are limited.</li>
            <li>Changes to the society&apos;s UPI ID need a second committee member to approve.</li>
          </ul>
          <p>If a breach affects your data we will tell you and the authorities as the law requires.</p>
        </Section>

        <Section title="7. How long we keep it">
          <ul className={li}>
            <li><b>Account details:</b> while you are linked to the society. When you leave, your profile can be anonymised on request.</li>
            <li><b>Financial records</b> (dues, payments, receipts, expenses, tax and audit documents): up to 8 years, because societies must keep accounts. These records stay even if your profile is anonymised, without your name.</li>
            <li><b>Community posts and comments:</b> until you or the committee delete them, or your profile is anonymised.</li>
            <li><b>Deleted documents:</b> removed from storage 30 days after deletion. Unfinished uploads are removed within a day.</li>
          </ul>
        </Section>

        <Section title="8. Your rights">
          <p>You can:</p>
          <ul className={li}>
            <li><b>Get a copy</b> of the data we hold about you: open <i>Privacy &amp; my data</i> in the app and choose Download my data.</li>
            <li><b>Ask us to correct</b> anything that is wrong or out of date.</li>
            <li><b>Ask us to erase</b> your personal data. We will do so unless the law requires us to keep it (for example financial records), and we will tell you what we kept and why.</li>
            <li><b>Withdraw your consent</b> by asking for erasure. You will not be able to use the app without it.</li>
            <li><b>Complain.</b> Write to {contact}
              {op.grievanceOfficer ? <> (grievance officer: {op.grievanceOfficer})</> : null}. We will reply within 15 days. If you are not satisfied, you can approach the Data Protection Board of India.</li>
          </ul>
        </Section>

        <Section title="9. Children">
          <p>The app is for adults. Children&apos;s details are not collected on purpose. If a minor is listed, it should be by a parent or guardian.</p>
        </Section>

        <Section title="10. Cookies">
          <p>We use one essential cookie to keep you signed in. There are no advertising or tracking cookies.</p>
        </Section>

        <Section title="11. Changes">
          <p>If we change this notice in a way that matters, we will update the version above and ask you to agree again.</p>
        </Section>

        {(op.address || op.email) && (
          <p className="border-t border-border pt-4 text-muted-foreground">
            {op.name}
            {op.address ? ` · ${op.address}` : ""}
            {op.email ? ` · ${op.email}` : ""}
          </p>
        )}
      </article>
    </main>
  );
}
