import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Forgot password?" subtitle="We'll email you a code to reset it">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
