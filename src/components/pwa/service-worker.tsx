"use client";

import { useEffect } from "react";
import { isNativeShell } from "@/lib/utils/pwa";

/** Registers the service worker (production only, and not inside the Android/iPhone app shell). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator) || isNativeShell(navigator.userAgent)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* the app works without it */
    });
  }, []);
  return null;
}
