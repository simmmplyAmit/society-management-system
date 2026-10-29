"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/client/report-error";

// Shown inside the dashboard (navigation stays usable) when a page fails to load.
export default function DashboardError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  const t = useTranslations();
  useEffect(() => reportError(error), [error]);
  return (
    <div className="mx-auto max-w-sm py-16 text-center">
      <AlertTriangle className="mx-auto size-8 text-amber-600" />
      <h2 className="mt-3 text-lg font-semibold">{t("errorPage.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("errorPage.body")}</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">{t("errorPage.reference", { digest: error.digest })}</p>}
      <Button className="mt-5" onClick={() => unstable_retry()}>
        {t("common.tryAgain")}
      </Button>
    </div>
  );
}
