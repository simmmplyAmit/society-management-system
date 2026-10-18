import Link from "next/link";
import { requireRole } from "@/lib/session";
import { getAllSocieties } from "@/lib/queries/societies";
import { CreateSocietyForm } from "@/components/super-admin/create-society-form";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/month";
import { Badge } from "@/components/ui/badge";
import { ToolSection } from "@/components/ui/tool-section";
import { Building2 } from "lucide-react";

export default async function SuperAdminPage() {
  await requireRole(["SUPER_ADMIN"]);
  const societies = await getAllSocieties();

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6 lg:max-w-5xl lg:px-8 lg:py-8">
      <div>
        <h1 className="text-2xl font-semibold">Platform admin</h1>
        <p className="text-sm text-muted-foreground">{societies.length} societies onboarded</p>
      </div>
      <ToolSection title="Onboard a society" description="Create a society and its first admin" icon={Building2}>
        <CreateSocietyForm />
      </ToolSection>
      <h2 className="pt-1 text-sm font-semibold">Societies</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {societies.map((s) => (
          <Link key={s.id} href={`/super-admin/${s.id}`} className="block">
          <Card className="transition-colors hover:bg-muted/50">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-semibold">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[s.city, `${s._count.users} users`, `since ${formatDate(s.createdAt)}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Badge variant={s.isActive ? "success" : "outline"}>{s.isActive ? "Active" : "Inactive"}</Badge>
            </CardContent>
          </Card>
          </Link>
        ))}
        {societies.length === 0 && (
          <p className="text-sm text-muted-foreground">No societies yet.</p>
        )}
      </div>
    </main>
  );
}
