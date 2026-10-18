import { requireRole } from "@/lib/session";
import { TopBar } from "@/components/layout/top-bar";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["SUPER_ADMIN"]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar user={session.user} />
      {children}
    </div>
  );
}
