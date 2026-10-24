import { LoginForm } from "@/components/auth/login-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your society">
      <LoginForm />
    </AuthShell>
  );
}
