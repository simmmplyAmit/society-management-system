"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";
import { NAV_ITEMS, isNavActive } from "./nav-items";
import type { Role } from "@prisma/client";

export function Sidebar({ role, societyName }: { role: Role; societyName: string }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => i.roles.includes(role));

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-white px-4 py-5 lg:flex">
      <div className="flex items-center gap-3 px-2">
        <BrandMark />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{societyName}</p>
          <p className="text-xs text-muted-foreground">Society manager</p>
        </div>
      </div>
      <nav className="mt-8 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-[18px]" strokeWidth={active ? 2.4 : 2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
