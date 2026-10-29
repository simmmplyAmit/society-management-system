import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { ChevronRight } from "lucide-react";

export default async function MorePage() {
  const session = await getSession();
  const t = await getTranslations();
  const items = NAV_ITEMS.filter((i) => i.roles.includes(session.user.role));
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">{t("nav.menu")}</h2>
      <div className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium hover:bg-muted/40">
              <Icon className="size-[18px] text-primary" />
              <span className="flex-1">{t(`nav.${item.key}`)}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
      <div className="rounded-xl bg-card p-4 ring-1 ring-border">
        <p className="mb-2 text-sm font-medium">{t("common.language")}</p>
        <LanguageSwitcher />
      </div>
    </div>
  );
}
