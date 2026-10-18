import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const society = session.user.societyId
    ? await prisma.society.findUnique({
        where: { id: session.user.societyId },
        select: { name: true },
      })
    : null;
  const societyName = society?.name ?? "Society MS";

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={session.user.role} societyName={societyName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={session.user} societyName={societyName} />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-5 lg:max-w-5xl lg:px-8 lg:pb-10 lg:pt-8">
          {children}
        </main>
        <BottomNav role={session.user.role} />
      </div>
    </div>
  );
}
