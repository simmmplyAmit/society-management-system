import { getTranslations } from "next-intl/server";
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
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import type { Role } from "@prisma/client";

interface TopBarProps {
  societyName?: string;
  user: {
    name: string;
    email: string;
    image?: string | null;
    role: Role;
  };
}

export async function TopBar({ user, societyName }: TopBarProps) {
  const t = await getTranslations();
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
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
          <DropdownMenuLabel className="pb-1">
            <p className="font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground font-normal truncate">
              {user.email}
            </p>
            <Badge variant="secondary" className="mt-1 text-xs">
              {t(`roles.${user.role}`)}
            </Badge>
          </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5">
            <p className="mb-1 text-xs text-muted-foreground">{t("common.language")}</p>
            <LanguageSwitcher compact />
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <SignOutButton />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
