import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { TopBar } from "@/components/layout/top-bar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <TopBar user={session.user} />
      <main className="flex-1 pb-20 px-4 pt-4 max-w-2xl mx-auto w-full">
        {children}
      </main>
      <BottomNav role={session.user.role} />
    </div>
  );
}
