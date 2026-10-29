import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/layout/brand-mark";
import { SignOutButton } from "@/components/auth/sign-out-button";
import type { Role } from "@prisma/client";

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  SECRETARY: "Secretary",
  TREASURER: "Treasurer",
  OWNER: "Owner",
  TENANT: "Tenant",
};

interface TopBarProps {
  societyName?: string;
  user: {
    name: string;
    email: string;
    image?: string | null;
    role: Role;
  };
}

export function TopBar({ user, societyName }: TopBarProps) {
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-white/90 px-4 py-2.5 backdrop-blur lg:px-8">
      <div className="flex items-center gap-2.5 lg:hidden">
        <BrandMark className="size-8" />
        <h1 className="text-sm font-semibold">{societyName ?? "Society MS"}</h1>
      </div>
      <div className="hidden lg:block" />
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 outline-none">
          <span className="flex items-center gap-2">
            <Avatar className="h-9 w-9 ring-2 ring-primary/15">
              <AvatarImage src={user.image ?? undefined} alt={user.name} />
              <AvatarFallback className="text-xs bg-primary/10 font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
          <DropdownMenuLabel className="pb-1">
            <p className="font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground font-normal truncate">
              {user.email}
            </p>
            <Badge variant="secondary" className="mt-1 text-xs">
              {ROLE_LABELS[user.role]}
            </Badge>
          </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {user.role !== "SUPER_ADMIN" && (
            <DropdownMenuItem>
              <Link href="/dashboard/privacy" className="w-full">🔐 Privacy &amp; my data</Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem>
            <SignOutButton />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
