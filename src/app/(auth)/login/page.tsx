import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Society MS</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to your account</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
