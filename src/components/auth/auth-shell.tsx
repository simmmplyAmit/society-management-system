import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrandMark } from "@/components/layout/brand-mark";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { IndianRupee, ShieldCheck, Smartphone } from "lucide-react";

export async function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const t = await getTranslations("auth");
  const points = [
    { icon: IndianRupee, text: t("shellPoint1") },
    { icon: ShieldCheck, text: t("shellPoint2") },
    { icon: Smartphone, text: t("shellPoint3") },
  ];
  const link = "underline underline-offset-2 hover:text-foreground";

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <BrandMark className="size-10 bg-white/15 from-transparent to-transparent shadow-none ring-1 ring-white/25" />
          <span className="text-lg font-semibold">Society MS</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-4xl font-semibold leading-tight">{t("shellHeadline")}</h2>
          <ul className="mt-8 space-y-4">
            {points.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-indigo-100">
                <Icon className="mt-0.5 size-5 shrink-0 text-white" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-indigo-200">{t("shellFooter")}</p>
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-white/10 blur-2xl" />
      </section>

      <section className="flex flex-col items-center justify-center px-5 py-10">
        <LanguageSwitcher className="mb-8 lg:mb-10" />
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <BrandMark className="mb-5 size-12 lg:hidden" />
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
          <p className="mt-8 text-center text-xs text-muted-foreground lg:text-left">
            {t.rich("agree", {
              terms: (chunks) => <Link href="/terms" className={link}>{chunks}</Link>,
              privacy: (chunks) => <Link href="/privacy" className={link}>{chunks}</Link>,
            })}
          </p>
        </div>
      </section>
    </main>
  );
}
