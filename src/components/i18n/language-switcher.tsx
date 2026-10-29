"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { toast } from "sonner";
import { setLocale } from "@/actions/locale";
import { baseLocale, LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** English / हिन्दी / मराठी. Each name is shown in its own script so anyone can find theirs. */
export function LanguageSwitcher({ className, compact = false }: { className?: string; compact?: boolean }) {
  const current = baseLocale(useLocale());
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(locale: Locale) {
    if (locale === current) return;
    const fd = new FormData();
    fd.set("locale", locale);
    startTransition(async () => {
      const r = await setLocale(fd);
      if ("error" in r) return void toast.error(r.error);
      router.refresh();
    });
  }

  return (
    <div role="group" aria-label={t("language")} className={cn("flex items-center gap-1", className)}>
      {!compact && <Languages className="mr-1 size-4 text-muted-foreground" aria-hidden />}
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          disabled={pending}
          aria-pressed={l === current}
          onClick={() => choose(l)}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60",
            l === current ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {LOCALE_NAMES[l]}
        </button>
      ))}
    </div>
  );
}
