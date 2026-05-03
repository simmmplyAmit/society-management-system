"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Building2,
  Users,
  Receipt,
  TrendingDown,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Home",
    icon: Home,
    roles: ["SUPER_ADMIN", "ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"],
  },
  {
    href: "/dashboard/society",
    label: "Society",
    icon: Building2,
    roles: ["ADMIN", "SECRETARY"],
  },
  {
    href: "/dashboard/residents",
    label: "Residents",
    icon: Users,
    roles: ["ADMIN", "SECRETARY"],
  },
  {
    href: "/dashboard/maintenance",
    label: "Maintenance",
    icon: Receipt,
    roles: ["ADMIN", "TREASURER", "OWNER", "TENANT"],
  },
  {
    href: "/dashboard/expenses",
    label: "Expenses",
    icon: TrendingDown,
    roles: ["ADMIN", "SECRETARY", "TREASURER"],
  },
  {
    href: "/dashboard/help",
    label: "Help",
    icon: HelpCircle,
    roles: ["SUPER_ADMIN", "ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"],
  },
];

interface BottomNavProps {
  role: Role;
}

export function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 safe-area-pb">
      <div className="flex items-center justify-around max-w-2xl mx-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 px-3 min-w-[52px] transition-colors",
                isActive
                  ? "text-slate-900"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  isActive && "stroke-[2.5]"
                )}
              />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
