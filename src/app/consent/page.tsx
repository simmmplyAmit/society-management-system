import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { needsConsent } from "@/lib/privacy";
import { AuthShell } from "@/components/auth/auth-shell";
import { ConsentForm } from "@/components/auth/consent-form";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function ConsentPage() {
  const session = await getSession();
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, privacyVersion: true } });
  if (!user) redirect("/login");
  if (!needsConsent(user)) redirect("/dashboard");

  return (
    <AuthShell title="Your privacy" subtitle="Please review how your details are used before you continue">
      <ConsentForm />
      <div className="mt-6 flex justify-center text-sm text-muted-foreground">
        <SignOutButton />
      </div>
    </AuthShell>
  );
}
