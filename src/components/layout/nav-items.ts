import {
  LayoutDashboard,
  Building2,
  Users,
  Receipt,
  TrendingDown,
  HelpCircle,
} from "lucide-react";
import type { Role } from "@prisma/client";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: Role[];
}

const ALL: Role[] = ["SUPER_ADMIN", "ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"];

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, roles: ALL },
  { href: "/dashboard/society", label: "Society", icon: Building2, roles: ["ADMIN", "SECRETARY"] },
  { href: "/dashboard/residents", label: "Residents", icon: Users, roles: ["ADMIN", "SECRETARY"] },
  { href: "/dashboard/maintenance", label: "Dues", icon: Receipt, roles: ["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"] },
  { href: "/dashboard/expenses", label: "Expenses", icon: TrendingDown, roles: ["ADMIN", "SECRETARY", "TREASURER"] },
  { href: "/dashboard/help", label: "Help", icon: HelpCircle, roles: ALL },
];

export function isNavActive(href: string, pathname: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}
