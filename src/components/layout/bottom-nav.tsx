"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { mobileItems, isNavActive } from "./nav-items";
import type { Role } from "@prisma/client";

export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { items } = mobileItems(role);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/90 backdrop-blur lg:hidden safe-area-pb">
      <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-[10px] font-medium"
            >
              <span
                className={cn(
                  "flex h-7 w-11 items-center justify-center rounded-full transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="size-[18px]" strokeWidth={active ? 2.4 : 2} />
              </span>
              <span className={cn("max-w-full truncate", active ? "text-primary" : "text-muted-foreground")}>
                {t(item.key)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
