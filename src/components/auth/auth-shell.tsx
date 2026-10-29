import Link from "next/link";
import { BrandMark } from "@/components/layout/brand-mark";
import { IndianRupee, ShieldCheck, Smartphone } from "lucide-react";

const POINTS = [
  { icon: IndianRupee, text: "Maintenance dues collected by UPI, tracked automatically" },
  { icon: ShieldCheck, text: "Every society's data kept separate and secure" },
  { icon: Smartphone, text: "Works like an app on any phone" },
];

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <BrandMark className="size-10 bg-white/15 from-transparent to-transparent shadow-none ring-1 ring-white/25" />
          <span className="text-lg font-semibold">Society MS</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-4xl font-semibold leading-tight">
            Run your society without the spreadsheets.
          </h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-indigo-100">
                <Icon className="mt-0.5 size-5 shrink-0 text-white" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-indigo-200">Dues · Expenses · Residents</p>
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-white/10 blur-2xl" />
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <BrandMark className="mb-5 size-12 lg:hidden" />
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground hover:underline">Privacy Notice</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
