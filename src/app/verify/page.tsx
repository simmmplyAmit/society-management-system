import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUnverified } from "@/lib/session";
import { isFullyVerified } from "@/lib/verification";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyContact } from "@/components/auth/verify-contact";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { maskEmail } from "@/lib/utils/phone";

export default async function VerifyPage() {
  const session = await getSessionUnverified();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, email: true, phone: true, emailVerifiedAt: true, phoneVerifiedAt: true },
  });
  if (!user) redirect("/login");
  if (isFullyVerified(user)) redirect("/dashboard");

  return (
    <AuthShell
      title="Verify your account"
      subtitle="Confirm your email and mobile number to continue"
    >
      <VerifyContact
        maskedEmail={maskEmail(user.email)}
        emailVerified={Boolean(user.emailVerifiedAt)}
        initialPhone={user.phone ?? ""}
        phoneVerified={Boolean(user.phoneVerifiedAt)}
      />
      <div className="mt-6 flex justify-center text-sm text-muted-foreground">
        <SignOutButton />
      </div>
    </AuthShell>
  );
}
