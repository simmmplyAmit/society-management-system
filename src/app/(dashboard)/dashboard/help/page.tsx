import { requireRole } from "@/lib/session";
import { ROLE_GUIDES } from "@/lib/help-content";
import { RoleTabs } from "@/components/help/role-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { HelpCircle, MessageCircle } from "lucide-react";

export default async function HelpPage() {
  const session = await requireRole([
    "SUPER_ADMIN", "ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT",
  ]);

  const { role } = session.user;

  // SUPER_ADMIN sees all guides; others see all but their own is highlighted
  const visibleGuides = ROLE_GUIDES;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-slate-500" />
          <h2 className="text-2xl font-semibold">Help & User Guide</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Step-by-step journeys for every role in Society MS
        </p>
      </div>

      {/* Quick tip for current user */}
      <Card className="border-0 bg-gradient-to-br from-indigo-600 to-violet-700 text-white ring-0">
        <CardContent className="p-4">
          <p className="text-xs text-white/70 mb-1">Your role</p>
          <p className="font-semibold">
            {ROLE_GUIDES.find((g) => g.role === role)?.label ?? role}
          </p>
          <p className="text-xs text-white/80 mt-1">
            {ROLE_GUIDES.find((g) => g.role === role)?.tagline}
          </p>
          <p className="text-xs text-white/70 mt-2">
            Your guide is pre-expanded below. Tap other tabs to explore what
            other roles can do.
          </p>
        </CardContent>
      </Card>

      {/* Role-tabbed guides */}
      <RoleTabs guides={visibleGuides} currentRole={role} />

      {/* Footer */}
      <Card>
        <CardContent className="p-4 flex items-start gap-3">
          <MessageCircle className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Need more help?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Contact your Society Admin if you cannot find what you&apos;re looking
              for. Admins can manage all users, flats, charges, and
              configuration from a single login.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
