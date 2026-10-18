import { LoginForm } from "@/components/auth/login-form";
import { BrandMark } from "@/components/layout/brand-mark";
import { IndianRupee, ShieldCheck, Smartphone } from "lucide-react";

const POINTS = [
  { icon: IndianRupee, text: "Maintenance dues collected by UPI, tracked automatically" },
  { icon: ShieldCheck, text: "Every society's data kept separate and secure" },
  { icon: Smartphone, text: "Works like an app on any phone" },
];

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
            <BrandMarkGlyph />
          </span>
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
            <h1 className="text-2xl font-semibold">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to manage your society
            </p>
          </div>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}

function BrandMarkGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4" />
    </svg>
  );
}
