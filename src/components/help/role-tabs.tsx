"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { RoleGuideCard } from "./role-guide";
import type { RoleGuide } from "@/lib/help-content";
import type { Role } from "@prisma/client";

interface RoleTabsProps {
  guides: RoleGuide[];
  currentRole: Role;
}

export function RoleTabs({ guides, currentRole }: RoleTabsProps) {
  const t = useTranslations("help");
  const [activeRole, setActiveRole] = useState<Role>(currentRole);
  const activeGuide = guides.find((g) => g.role === activeRole) ?? guides[0];

  return (
    <div className="space-y-4">
      {/* Role pill selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {guides.map((guide) => {
          const isActive = guide.role === activeRole;
          const isCurrent = guide.role === currentRole;
          return (
            <button
              key={guide.role}
              onClick={() => setActiveRole(guide.role)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {guide.label}
              {isCurrent && !isActive && (
                <span className="ml-1 text-[9px] opacity-60">{t("youShort")}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active guide */}
      {activeGuide && (
        <RoleGuideCard
          guide={activeGuide}
          isCurrentRole={activeGuide.role === currentRole}
          defaultOpen={activeGuide.role === currentRole}
        />
      )}
    </div>
  );
}
