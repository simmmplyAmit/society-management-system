import Link from "next/link";
import {
  Banknote,
  BellRing,
  CheckCircle2,
  FileText,
  HandCoins,
  IndianRupee,
  Landmark,
  Megaphone,
  MessageCircle,
  Receipt,
  ShieldCheck,
  Smartphone,
  Users,
  Wallet,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { contactHref, SITE, whatsappHref } from "@/lib/site";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: IndianRupee,
    title: "Dues collected by UPI",
    text: "Monthly maintenance raised for every flat automatically. Residents pay straight to the society’s UPI ID from a link and report the UTR.",
  },
  {
    icon: Wallet,
    title: "Part-payments and advance credit",
    text: "Paid a little less or a lot more? The balance carries forward as credit and settles the next dues on its own.",
  },
  {
    icon: Receipt,
    title: "Numbered cash receipts",
    text: "Cash taken at the door gets a receipt number, shows who is holding it, and is tracked until it reaches the bank.",
  },
  {
    icon: HandCoins,
    title: "Expenses and other income",
    text: "Record bills with photos of the receipt, hall rent and bank interest. A yearly statement is ready for the general body meeting.",
  },
  {
    icon: Landmark,
    title: "Bank balance tally",
    text: "See what the bank balance should be and compare it with the statement. Differences are logged, not hidden.",
  },
  {
    icon: BellRing,
    title: "Reminders that send themselves",
    text: "New-due notices and reminders by SMS and email, and a receipt when a payment is confirmed. Nobody has to chase anyone.",
  },
  {
    icon: Megaphone,
    title: "Notices, community and complaints",
    text: "Replace the notice board and the WhatsApp group noise. Complaints are tracked from raised to resolved.",
  },
  {
    icon: FileText,
    title: "Document locker",
    text: "Bylaws, minutes, audit reports and tax receipts in one private place, with the right ones visible to residents.",
  },
];

const CONTROLS = [
  "Changing the society’s UPI ID needs a second committee member’s approval, and everyone is emailed.",
  "Cash deposited in the bank is confirmed by a different person against the bank statement.",
  "A committee member can’t credit themselves for an expense they paid without someone else approving it.",
  "Payment records are never edited or deleted, so the history always adds up.",
];

const ROLES = [
  {
    icon: ShieldCheck,
    title: "Committee",
    text: "Set up wings and flats, add residents, set charges, post notices and handle complaints.",
  },
  {
    icon: Banknote,
    title: "Treasurer",
    text: "Verify UPI payments, collect cash, record expenses and keep the bank tally.",
  },
  {
    icon: Users,
    title: "Residents",
    text: "See what is due for each flat they own or rent, pay by UPI and get a receipt once it’s confirmed.",
  },
];

const FAQ = [
  {
    q: "Do residents need to install an app?",
    a: "No. It opens in the phone’s browser and can be added to the home screen like an app. It works on any Android phone or iPhone.",
  },
  {
    q: `Does ${SITE.brand} handle our society’s money?`,
    a: `No. Residents pay directly into the society’s own bank account through its UPI ID. ${SITE.brand} only keeps the records; we never receive, hold or move the society’s money.`,
  },
  {
    q: "Who can see our data?",
    a: "Only your society’s members, and each person sees only what their role allows. Residents see their own flats’ dues. Committee-only documents and internal complaint notes stay with the committee.",
  },
  {
    q: "We have only 30 flats. Is this for us?",
    a: "Yes. It’s built for small and mid-size societies run by volunteer committees that still use a register or a spreadsheet.",
  },
  {
    q: "What if we decide to stop?",
    a: "You can cancel at any time. Your society’s records belong to you, and we provide an export when you leave.",
  },
];

function Pricing() {
  const price = SITE.pricing.perFlatMonthly;
  return (
    <div className="mx-auto max-w-lg rounded-2xl bg-card p-6 ring-1 ring-border shadow-sm sm:p-8">
      {price === null ? (
        <>
          <p className="text-sm font-medium text-primary">Pilot programme</p>
          <p className="mt-2 text-3xl font-semibold">Free for early societies</p>
          <p className="mt-3 text-sm text-muted-foreground">
            We’re onboarding a small number of societies at no cost. Before any charge starts,
            we’ll tell you the price at least {SITE.pricing.noticeDays} days in advance, and you
            can leave with your data if it doesn’t suit you.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-primary">One simple plan</p>
          <p className="mt-2 text-4xl font-semibold">
            ₹{price}
            <span className="text-base font-normal text-muted-foreground"> per flat / month</span>
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Every feature included. Plus GST. Cancel any time.
          </p>
        </>
      )}
      <ul className="mt-6 space-y-2.5 text-sm">
        {["Unlimited residents and committee members", "SMS and email reminders", "Document storage", "All features, no add-ons"].map((t) => (
          <li key={t} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
            {t}
          </li>
        ))}
      </ul>
      <a href={contactHref()} className={cn(buttonVariants(), "mt-7 w-full")}>
        Request a demo
      </a>
    </div>
  );
}

function PhonePreview() {
  const rows = [
    { flat: "A-101", name: "Mehta", status: "Paid", tone: "text-emerald-700 bg-emerald-50" },
    { flat: "A-102", name: "Iyer", status: "Verify UTR", tone: "text-amber-700 bg-amber-50" },
    { flat: "A-201", name: "Khan", status: "Paid", tone: "text-emerald-700 bg-emerald-50" },
    { flat: "B-104", name: "Patil", status: "₹1,200 due", tone: "text-rose-700 bg-rose-50" },
  ];
  return (
    <div aria-hidden className="mx-auto w-full max-w-[300px] rounded-[2rem] bg-foreground/90 p-2.5 shadow-2xl shadow-indigo-900/20">
      <div className="rounded-[1.6rem] bg-background p-4">
        <p className="text-xs text-muted-foreground">October maintenance</p>
        <p className="mt-1 text-2xl font-semibold">42 of 48 paid</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-[87%] rounded-full bg-primary" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-card p-2.5 ring-1 ring-border">
            <p className="text-muted-foreground">Collected</p>
            <p className="mt-0.5 font-semibold">₹1,00,800</p>
          </div>
          <div className="rounded-xl bg-card p-2.5 ring-1 ring-border">
            <p className="text-muted-foreground">Pending</p>
            <p className="mt-0.5 font-semibold">₹14,400</p>
          </div>
        </div>
        <ul className="mt-4 divide-y rounded-xl bg-card text-xs ring-1 ring-border">
          {rows.map((r) => (
            <li key={r.flat} className="flex items-center justify-between px-3 py-2.5">
              <span>
                <span className="font-medium">{r.flat}</span>
                <span className="text-muted-foreground"> · {r.name}</span>
              </span>
              <span className={cn("rounded-full px-2 py-0.5 font-medium", r.tone)}>{r.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 text-muted-foreground">{text}</p>}
    </div>
  );
}

export default function LandingPage() {
  const wa = whatsappHref();
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 mx-auto h-96 max-w-4xl rounded-full bg-gradient-to-br from-indigo-200/60 to-violet-200/40 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.15fr_1fr] md:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              <Smartphone className="size-3.5" /> No app download. Works on any phone.
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">
              Move your society off registers and spreadsheets.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Maintenance dues, UPI payments, cash receipts, expenses, notices and complaints, on
              every resident’s phone. Built for small and mid-size housing societies run by
              volunteer committees.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={contactHref()} className={cn(buttonVariants(), "h-11 px-6")}>
                Request a demo
              </a>
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline" }), "h-11 px-6")}>
                  <MessageCircle /> Chat on WhatsApp
                </a>
              )}
              <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }), "h-11 px-6")}>
                Sign in
              </Link>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Money goes straight to your society’s bank account. We never touch it.
            </p>
          </div>
          <PhonePreview />
        </div>
      </section>

      {/* Before / after */}
      <section className="border-y bg-card">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:px-6 md:grid-cols-3">
          {[
            { before: "A register, a calculator and a WhatsApp group", after: "Dues raised for every flat on the 1st, automatically" },
            { before: "The treasurer phoning flats about payments", after: "Reminders by SMS and email go out on their own" },
            { before: "Arguments at the AGM about where money went", after: "Every rupee in and out, recorded and visible to the committee" },
          ].map((x) => (
            <div key={x.before} className="rounded-xl p-1">
              <p className="text-sm text-muted-foreground line-through decoration-muted-foreground/40">{x.before}</p>
              <p className="mt-2 font-medium">{x.after}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeading
            eyebrow="Features"
            title="Everything the committee does, in one place"
            text="From the first bill to the yearly statement, without hiring an accountant to keep the books."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl bg-card p-5 ring-1 ring-border">
                <span className="inline-flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-2">
          <div>
            <ShieldCheck className="size-9" />
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Built so no one person can misuse funds</h2>
            <p className="mt-4 text-indigo-100">
              Most disputes in a society are about money. {SITE.brand} puts checks in place so
              the committee can show residents exactly what happened, and nobody has to take it
              on trust.
            </p>
          </div>
          <ul className="space-y-4">
            {CONTROLS.map((c) => (
              <li key={c} className="flex items-start gap-3 rounded-xl bg-white/10 p-4 ring-1 ring-white/15">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                <span className="text-sm">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Roles */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeading eyebrow="For everyone" title="One app, the right view for each person" />
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {ROLES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl bg-card p-6 ring-1 ring-border">
                <Icon className="size-6 text-primary" />
                <h3 className="mt-3 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-16 border-y bg-card/50">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeading eyebrow="Pricing" title="Simple, per-flat pricing" />
          <div className="mt-12">
            <Pricing />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-16">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <SectionHeading eyebrow="FAQ" title="Questions committees ask us" />
          <div className="mt-10 divide-y rounded-xl bg-card ring-1 ring-border">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {f.q}
                  <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto max-w-4xl rounded-2xl bg-card p-8 text-center ring-1 ring-border sm:p-12">
          <h2 className="text-2xl font-semibold sm:text-3xl">Ready to retire the register?</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Tell us your society’s name and number of flats, and we’ll show you how it works with
            your own setup.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <a href={contactHref()} className={cn(buttonVariants(), "h-11 px-6")}>
              Request a demo
            </a>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline" }), "h-11 px-6")}>
                <MessageCircle /> Chat on WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
