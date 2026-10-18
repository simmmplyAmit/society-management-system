import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <AuthShell title="Set a new password" subtitle="Enter the code we emailed you">
      <ResetPasswordForm defaultEmail={email ?? ""} />
    </AuthShell>
  );
}
