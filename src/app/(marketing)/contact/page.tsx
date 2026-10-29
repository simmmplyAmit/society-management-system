import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin, MessageCircle, ShieldCheck } from "lucide-react";
import { contactHref, SITE, whatsappHref } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch with the ${SITE.brand} team.`,
};

export default function ContactPage() {
  const wa = whatsappHref();
  const items = [
    {
      icon: Mail,
      title: "Demo and sales",
      body: <a href={contactHref()}>{SITE.contactEmail}</a>,
      note: "Tell us your society’s name, city and number of flats.",
    },
    {
      icon: Mail,
      title: "Support and billing",
      body: <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>,
      note: "Residents: for questions about your dues, please contact your society’s committee first.",
    },
    ...(wa
      ? [{ icon: MessageCircle, title: "WhatsApp", body: <a href={wa} target="_blank" rel="noopener noreferrer">Chat with us</a>, note: "Messages are answered on working days." }]
      : []),
    {
      icon: ShieldCheck,
      title: "Grievance Officer",
      body: (
        <>
          {SITE.grievanceOfficer.name} ·{" "}
          <a href={`mailto:${SITE.grievanceOfficer.email}`}>{SITE.grievanceOfficer.email}</a>
        </>
      ),
      note: (
        <>
          For privacy and data requests. See our <Link href="/privacy#grievance">Privacy Policy</Link>.
        </>
      ),
    },
    {
      icon: MapPin,
      title: "Registered address",
      body: (
        <>
          {SITE.legalName}
          <br />
          {SITE.address}
          {SITE.gstin && (
            <>
              <br />
              GSTIN: {SITE.gstin}
            </>
          )}
        </>
      ),
      note: null,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-semibold sm:text-4xl">Contact us</h1>
      <p className="mt-3 text-muted-foreground">
        We usually reply within two working days.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {items.map(({ icon: Icon, title, body, note }) => (
          <div key={title} className="rounded-xl bg-card p-5 ring-1 ring-border [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2">
            <Icon className="size-5 text-primary" />
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-1 text-sm break-words">{body}</p>
            {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
