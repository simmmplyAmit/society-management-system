import { requireRole } from "@/lib/session";
import { TopBar } from "@/components/layout/top-bar";
import { IntlProvider } from "@/components/i18n/intl-provider";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["SUPER_ADMIN"]);

  return (
    <IntlProvider className="flex min-h-screen flex-col bg-background">
      <TopBar user={session.user} />
      {children}
    </IntlProvider>
  );
}
