"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { resetPassword } from "@/actions/password-reset";
import { useErrorText } from "@/components/i18n/use-error-text";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm({ defaultEmail }: { defaultEmail: string }) {
  const t = useTranslations("auth");
  const errorText = useErrorText();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    if (formData.get("password") !== formData.get("confirm")) {
      toast.error(t("passwordsDontMatch"));
      return;
    }
    startTransition(async () => {
      const result = await resetPassword(formData);
      if ("error" in result && result.error) {
        toast.error(errorText(result.error));
        return;
      }
      toast.success(t("passwordUpdated"));
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
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" defaultValue={defaultEmail} autoComplete="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="code">{t("sixDigitCode")}</Label>
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
            <Label htmlFor="password">{t("newPassword")}</Label>
            <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} placeholder={t("newPasswordHint")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">{t("confirmPassword")}</Label>
            <PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={8} required />
          </div>
          <Button type="submit" size="lg" className="h-11 w-full" disabled={isPending}>
            {isPending ? t("updating") : t("updatePassword")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("noCode")}{" "}
            <Link href="/forgot-password" className="font-medium text-primary hover:underline">
              {t("sendAgain")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
