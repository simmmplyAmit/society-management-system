// Runs in the browser before the app starts. Uncaught errors and rejected promises are reported
// once Sentry has loaded (see src/lib/client/report-error.ts).
import { loadSentry } from "@/lib/client/report-error";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  window.addEventListener("load", () => void loadSentry(), { once: true });
}
