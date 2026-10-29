"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/client/report-error";

// Replaces the root layout when it fails, so it brings its own <html> and plain styles.
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => reportError(error), [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f5f6fa", color: "#1f2937", margin: 0 }}>
        <title>Something went wrong</title>
        <main style={{ maxWidth: 420, margin: "15vh auto", padding: "0 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 22 }}>Something went wrong</h1>
          <p style={{ color: "#6b7280", fontSize: 14 }}>
            We&apos;ve been told about it. Please try again in a moment.
            {error.digest && <><br />Reference: {error.digest}</>}
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{ marginTop: 16, padding: "10px 18px", borderRadius: 8, border: 0, background: "#4f46e5", color: "#fff", fontWeight: 600 }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
