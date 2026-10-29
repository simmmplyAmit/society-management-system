import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { appUrl } from "@/lib/notify/templates";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: `${SITE.brand} · ${SITE.tagline}`, template: `%s · ${SITE.brand}` },
  description:
    "Maintenance dues by UPI, cash receipts, expenses, notices and complaints for small and mid-size housing societies. Works on any phone.",
  openGraph: { siteName: SITE.brand, type: "website", locale: "en_IN" },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
