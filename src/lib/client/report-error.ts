// Browser-side error reporting. The Sentry SDK is loaded only when NEXT_PUBLIC_SENTRY_DSN is set,
// and only after the page has loaded, so it adds nothing to page weight otherwise.
import type { BrowserOptions } from "@sentry/nextjs";

type SentryModule = typeof import("@sentry/nextjs");
let loading: Promise<SentryModule | null> | null = null;

export function loadSentry(): Promise<SentryModule | null> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn || typeof window === "undefined") return Promise.resolve(null);
  loading ??= Promise.all([import("@sentry/nextjs"), import("@/lib/sentry")])
    .then(([Sentry, { SENTRY_OPTIONS }]) => {
      Sentry.init({ dsn, ...(SENTRY_OPTIONS as BrowserOptions) });
      return Sentry;
    })
    .catch(() => null);
  return loading;
}

/** Reports an error caught by an error boundary. Never throws. */
export function reportError(error: unknown) {
  void loadSentry().then((Sentry) => Sentry?.captureException(error));
}
