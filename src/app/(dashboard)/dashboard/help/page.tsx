import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/session";
import { ROLE_GUIDES, type RoleGuide } from "@/lib/help-content";
import { RoleTabs } from "@/components/help/role-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { HelpCircle, MessageCircle } from "lucide-react";
import { SITE } from "@/lib/site";

type T = Awaited<ReturnType<typeof getTranslations<"help">>>;

/** Owner and tenant guides come from the translations, so residents read them in their language. */
function residentSections(t: T): RoleGuide["sections"] {
  const steps = (prefix: string, n: number, paths: Record<number, [string, string]> = {}) =>
    Array.from({ length: n }, (_, i) => ({
      step: i + 1,
      title: t(`resident.${prefix}${i + 1}Title` as "resident.dues1Title"),
      description: t(`resident.${prefix}${i + 1}` as "resident.dues1"),
      ...(paths[i + 1] ? { path: paths[i + 1][0], pathLabel: paths[i + 1][1] } : {}),
    }));
  return [
    {
      id: "resident-dues",
      title: t("resident.duesTitle"),
      icon: "🏠",
      summary: t("resident.duesSummary"),
      steps: steps("dues", 5, { 1: ["/dashboard/maintenance", t("pathDues")] }),
    },
    {
      id: "resident-community",
      title: t("resident.communityTitle"),
      icon: "📣",
      summary: t("resident.communitySummary"),
      steps: steps("community", 4, { 1: ["/dashboard/notices", t("pathNotices")], 2: ["/dashboard/complaints", t("pathComplaints")] }),
    },
    {
      id: "resident-language",
      title: t("resident.languageTitle"),
      icon: "🌐",
      summary: t("resident.languageSummary"),
      steps: steps("language", 1),
    },
  ];
}

export default async function HelpPage() {
  const session = await requireRole([
    "SUPER_ADMIN", "ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT",
  ]);
  const { role } = session.user;
  const [t, tr, locale] = await Promise.all([getTranslations("help"), getTranslations("roles"), getLocale()]);

  // Everyone sees every role's guide, their own first-highlighted. Committee guides are English only.
  const guides: RoleGuide[] = ROLE_GUIDES.map((g) => {
    const label = tr(g.role);
    if (g.role === "OWNER") return { ...g, label, tagline: t("resident.ownerTagline"), sections: residentSections(t) };
    if (g.role === "TENANT") return { ...g, label, tagline: t("resident.tenantTagline"), sections: residentSections(t) };
    return { ...g, label, ...(locale !== "en" ? { note: t("englishOnly") } : {}) };
  });
  const mine = guides.find((g) => g.role === role);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-slate-500" />
          <h2 className="text-2xl font-semibold">{t("title")}</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{t("subtitle", { brand: SITE.brand })}</p>
      </div>

      {/* Quick tip for current user */}
      <Card className="border-0 bg-gradient-to-br from-indigo-600 to-violet-700 text-white ring-0">
        <CardContent className="p-4">
          <p className="text-xs text-white/70 mb-1">{t("yourRole")}</p>
          <p className="font-semibold">{mine?.label ?? role}</p>
          <p className="text-xs text-white/80 mt-1">{mine?.tagline}</p>
          <p className="text-xs text-white/70 mt-2">{t("guideHint")}</p>
        </CardContent>
      </Card>

      {/* Role-tabbed guides */}
      <RoleTabs guides={guides} currentRole={role} />

      {/* Footer */}
      <Card>
        <CardContent className="p-4 flex items-start gap-3">
          <MessageCircle className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">{t("moreHelp")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("moreHelpText")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
