import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/session";
import { getSocietyOverview } from "@/lib/queries/societies";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils/month";

export default async function SocietyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["SUPER_ADMIN"]);
  const { id } = await params;
  const overview = await getSocietyOverview(id);
  if (!overview) notFound();

  const { society, users, flats, wings, payments, expenseTotal } = overview;
  const location = [society.address, society.city, society.state, society.pincode]
    .filter(Boolean)
    .join(", ");

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6">
      <Link
        href="/super-admin"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
      >
        <ArrowLeft className="h-3 w-3" /> All societies
      </Link>

      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">{society.name}</h1>
          <Badge variant={society.isActive ? "secondary" : "outline"}>
            {society.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {[location, `since ${formatDate(society.createdAt)}`].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Users" value={users.length} />
        <Stat label="Flats" value={flats} />
        <Stat label={society.hasWings ? "Wings" : "Layout"} value={society.hasWings ? wings : "Single"} />
      </div>

      <Card>
        <CardContent className="space-y-1 p-3 text-sm">
          <p className="font-medium">Finance</p>
          <p className="text-xs text-muted-foreground">UPI ID: {society.upiId ?? "Not set"}</p>
          <p className="text-xs text-muted-foreground">
            Total expenses: {formatCurrency(expenseTotal)}
          </p>
          {payments.length === 0 && (
            <p className="text-xs text-muted-foreground">No maintenance dues generated yet.</p>
          )}
          {payments.map((p) => (
            <p key={p.status} className="text-xs text-muted-foreground">
              {p.status}: {p.count} dues · {formatCurrency(p.total)}
            </p>
          ))}
        </CardContent>
      </Card>

      <h2 className="pt-2 text-sm font-semibold">Users ({users.length})</h2>
      <div className="space-y-2">
        {users.map((u) => (
          <Card key={u.id}>
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium">{u.name}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                {u.role}
                {!u.isActive && " · inactive"}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <p className="text-lg font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
