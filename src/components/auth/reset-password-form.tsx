"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { resetPassword } from "@/actions/password-reset";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm({ defaultEmail }: { defaultEmail: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    if (formData.get("password") !== formData.get("confirm")) {
      toast.error("Passwords do not match");
      return;
    }
    startTransition(async () => {
      const result = await resetPassword(formData);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Password updated. Please sign in");
      router.push("/login");
    });
  }

  return (
    <Card className="shadow-lg shadow-indigo-900/5">
      <CardContent className="p-5 sm:p-6">
        <form
          onSubmit={(e) => {
            // onSubmit (not action=) so React doesn't clear the fields when a request fails
            e.preventDefault();
            handleSubmit(new FormData(e.currentTarget));
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={defaultEmail} autoComplete="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="code">6-digit code</Label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="\d{6}"
              placeholder="123456"
              className="tracking-[0.4em]"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} placeholder="Min 8 characters" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <Button type="submit" size="lg" className="h-11 w-full" disabled={isPending}>
            {isPending ? "Updating…" : "Update password"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            No code?{" "}
            <Link href="/forgot-password" className="font-medium text-primary hover:underline">
              Send again
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
