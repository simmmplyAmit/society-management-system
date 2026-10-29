"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { INSTALL_DISMISS_KEY, installPlatform, isIosSafari, isNativeShell, snoozeExpired } from "@/lib/utils/pwa";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Mode = "android" | "ios" | null;

/** Offers to install the app: a real install button on Android, short instructions on iPhone. */
export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (standalone || isNativeShell(ua)) return; // already installed, or running inside the app

    let dismissedAt: number | null = null;
    try {
      dismissedAt = Number(localStorage.getItem(INSTALL_DISMISS_KEY)) || null;
    } catch {
      /* storage can be blocked */
    }
    if (!snoozeExpired(dismissedAt, Date.now())) return;

    if (isIosSafari(ua)) {
      const t = setTimeout(() => setMode("ios"), 0); // after mount, so server and client markup match
      return () => clearTimeout(t);
    }
    if (installPlatform(ua) !== "android") return; // keep it to phones: desktop browsers have their own install button

    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep the event so we can show our own button
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("android");
    };
    const onInstalled = () => setMode(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setMode(null);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === "accepted") setMode(null);
    else dismiss();
  }

  if (!mode) return null;
  return (
    <div className="animate-fade-up mb-4 flex items-start gap-3 rounded-xl bg-primary/5 p-3 ring-1 ring-primary/15">
      <span className="mt-0.5 text-xl" aria-hidden="true">📲</span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Install Society MS</p>
        {mode === "android" ? (
          <p className="text-xs text-muted-foreground">Add it to your home screen for one-tap access, like any other app.</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Tap <Share className="mx-0.5 inline size-3.5 align-text-bottom" /> Share, then <b>Add to Home Screen</b>.
          </p>
        )}
        {mode === "android" && (
          <Button size="sm" className="mt-2 h-8" onClick={install}>
            <Download className="size-3.5" /> Install
          </Button>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
        <X className="size-4" />
      </button>
    </div>
  );
}
