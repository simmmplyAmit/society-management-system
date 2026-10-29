import Link from "next/link";
import { getSession } from "@/lib/session";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { ChevronRight } from "lucide-react";
import { PageTitle } from "@/components/ui/page-title";

export default async function MorePage() {
  const session = await getSession();
  const items = NAV_ITEMS.filter((i) => i.roles.includes(session.user.role));
  return (
    <div className="space-y-4">
      <PageTitle emoji="🧭">Menu</PageTitle>
      <div className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium hover:bg-muted/40">
              <Icon className="size-[18px] text-primary" />
              <span className="flex-1">{item.label}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
