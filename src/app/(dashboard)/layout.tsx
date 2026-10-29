import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureVerified } from "@/lib/session";
import { needsConsent } from "@/lib/privacy";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { InstallPrompt } from "@/components/pwa/install-prompt";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await ensureVerified(session);

  const [society, me] = await Promise.all([
    session.user.societyId
      ? prisma.society.findUnique({ where: { id: session.user.societyId }, select: { name: true } })
      : Promise.resolve(null),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, privacyVersion: true } }),
  ]);
  // Everyone agrees to the current privacy notice before using the app (the platform team is exempt)
  if (me && needsConsent(me)) redirect("/consent");
  const societyName = society?.name ?? "Society MS";

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={session.user.role} societyName={societyName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={session.user} societyName={societyName} />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-5 lg:max-w-5xl lg:px-8 lg:pb-10 lg:pt-8">
          <InstallPrompt />
          {children}
        </main>
        <BottomNav role={session.user.role} />
      </div>
    </div>
  );
}
