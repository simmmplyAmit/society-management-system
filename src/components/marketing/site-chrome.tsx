import Link from "next/link";
import { BrandMark } from "@/components/layout/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { PUBLIC_PAGES, SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold">
          <BrandMark className="size-8" />
          {SITE.brand}
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-foreground">
              {n.label}
            </Link>
          ))}
        </nav>
        <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "ml-auto h-9")}>
          Sign in
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const links = PUBLIC_PAGES.filter((p) => p.href !== "/");
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto]">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5 font-semibold">
            <BrandMark className="size-7" />
            {SITE.brand}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{SITE.tagline}.</p>
        </div>
        <nav aria-label="Legal and contact" className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:gap-x-6">
          {links.map((p) => (
            <Link key={p.href} href={p.href} className="text-muted-foreground hover:text-foreground">
              {p.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} {SITE.legalName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
