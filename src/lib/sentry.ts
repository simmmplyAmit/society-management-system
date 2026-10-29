// Shared Sentry settings. Error monitoring only (no performance tracing, no session replay),
// and no personal data: Sentry does not receive cookies, IP addresses or request bodies.
import type { ErrorEvent } from "@sentry/nextjs";

export const SENTRY_OPTIONS = {
  tracesSampleRate: 0,
  sendDefaultPii: false,
  environment: process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  // Pages carry flat numbers and names in query strings only rarely, but drop them anyway
  beforeSend(event: ErrorEvent) {
    if (event.request) {
      delete event.request.cookies;
      delete event.request.data;
      if (event.request.url) event.request.url = event.request.url.split("?")[0];
      delete event.request.query_string;
    }
    delete event.user;
    return event;
  },
};
