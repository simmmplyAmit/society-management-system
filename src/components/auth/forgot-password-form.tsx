"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { requestPasswordReset } from "@/actions/password-reset";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const email = String(formData.get("email") ?? "").trim();
    startTransition(async () => {
      const result = await requestPasswordReset(formData);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("If that email has an account, a code is on its way");
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
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
            <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
          </div>
          <Button type="submit" size="lg" className="h-11 w-full" disabled={isPending}>
            {isPending ? "Sending…" : "Send code"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
