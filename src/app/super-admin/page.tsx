import Link from "next/link";
import { requireRole } from "@/lib/session";
import { getAllSocieties } from "@/lib/queries/societies";
import { CreateSocietyForm } from "@/components/super-admin/create-society-form";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/month";

export default async function SuperAdminPage() {
  await requireRole(["SUPER_ADMIN"]);
  const societies = await getAllSocieties();

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6">
      <h1 className="text-lg font-semibold">Platform admin</h1>
      <CreateSocietyForm />
      <h2 className="pt-2 text-sm font-semibold">Societies ({societies.length})</h2>
      <div className="space-y-2">
        {societies.map((s) => (
          <Link key={s.id} href={`/super-admin/${s.id}`} className="block">
          <Card className="transition-colors hover:bg-muted/50">
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[s.city, `${s._count.users} users`, `since ${formatDate(s.createdAt)}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{s.isActive ? "Active" : "Inactive"}</span>
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
