import {
  LayoutDashboard,
  Building2,
  Users,
  Receipt,
  TrendingDown,
  TrendingUp,
  FolderOpen,
  Megaphone,
  MessagesSquare,
  LifeBuoy,
  Menu,
  HelpCircle,
  FileSpreadsheet,
} from "lucide-react";
import type { Role } from "@prisma/client";

export interface NavItem {
  href: string;
  /** English label; the shown text comes from messages "nav.<key>". */
  label: string;
  key: NavKey;
  icon: React.ElementType;
  roles: Role[];
  /** Lower = shown first in the phone's bottom bar; the rest go under "More". */
  rank: number;
}

export type NavKey = "home" | "society" | "residents" | "dues" | "notices" | "complaints" | "community" | "expenses" | "documents" | "income" | "import" | "help" | "more";

const ALL: Role[] = ["SUPER_ADMIN", "ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"];

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", key: "home", icon: LayoutDashboard, roles: ALL, rank: 0 },
  { href: "/dashboard/society", label: "Society", key: "society", icon: Building2, roles: ["ADMIN", "SECRETARY"], rank: 7 },
  { href: "/dashboard/residents", label: "Residents", key: "residents", icon: Users, roles: ["ADMIN", "SECRETARY"], rank: 8 },
  { href: "/dashboard/maintenance", label: "Dues", key: "dues", icon: Receipt, roles: ["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"], rank: 1 },
  { href: "/dashboard/notices", label: "Notices", key: "notices", icon: Megaphone, roles: ["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"], rank: 2 },
  { href: "/dashboard/complaints", label: "Complaints", key: "complaints", icon: LifeBuoy, roles: ["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"], rank: 3 },
  { href: "/dashboard/community", label: "Community", key: "community", icon: MessagesSquare, roles: ["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"], rank: 5 },
  { href: "/dashboard/expenses", label: "Expenses", key: "expenses", icon: TrendingDown, roles: ["ADMIN", "SECRETARY", "TREASURER"], rank: 4 },
  { href: "/dashboard/documents", label: "Documents", key: "documents", icon: FolderOpen, roles: ["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"], rank: 6 },
  { href: "/dashboard/income", label: "Income", key: "income", icon: TrendingUp, roles: ["ADMIN", "SECRETARY", "TREASURER"], rank: 9 },
  { href: "/dashboard/import", label: "Import data", key: "import", icon: FileSpreadsheet, roles: ["ADMIN", "TREASURER"], rank: 10 },
  { href: "/dashboard/help", label: "Help", key: "help", icon: HelpCircle, roles: ALL, rank: 11 },
];

export function isNavActive(href: string, pathname: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}

export const MORE_ITEM = { href: "/dashboard/more", label: "More", key: "more" as const, icon: Menu };

/** Bottom bar: the 4 most important items for the role, then "More" if anything is left over. */
export function mobileItems(role: Role): { items: Pick<NavItem, "href" | "label" | "key" | "icon">[]; hasMore: boolean } {
  const all = NAV_ITEMS.filter((i) => i.roles.includes(role)).sort((a, b) => a.rank - b.rank);
  if (all.length <= 5) return { items: all, hasMore: false };
  return { items: [...all.slice(0, 4), MORE_ITEM], hasMore: true };
}
