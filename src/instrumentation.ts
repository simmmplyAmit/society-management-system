// Server-side error monitoring. Sentry starts only when SENTRY_DSN is set, so development and
// preview deployments without it report nothing.
import { captureRequestError } from "@sentry/nextjs";

export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  const [Sentry, { SENTRY_OPTIONS }] = await Promise.all([import("@sentry/nextjs"), import("@/lib/sentry")]);
  Sentry.init({ dsn, ...SENTRY_OPTIONS });
}

// Errors in server components, route handlers, server actions and the proxy (a no-op until Sentry starts)
export const onRequestError = captureRequestError;
