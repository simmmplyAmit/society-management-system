// Pure helpers for the install prompt and for detecting how the app is running.

export const INSTALL_DISMISS_KEY = "ms-install-dismissed-at";
export const INSTALL_SNOOZE_DAYS = 14;

/** True when the page runs inside the Capacitor app (the Android/iPhone shell). */
export function isNativeShell(userAgent: string): boolean {
  return /SocietyMS-(Android|iOS)/.test(userAgent);
}

export type InstallPlatform = "android" | "ios" | "other";

export function installPlatform(userAgent: string): InstallPlatform {
  if (/iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && /Mobile/.test(userAgent))) return "ios";
  if (/Android/.test(userAgent)) return "android";
  return "other";
}

/** iOS has no install prompt: people must use Share → Add to Home Screen, and only from Safari. */
export function isIosSafari(userAgent: string): boolean {
  return installPlatform(userAgent) === "ios" && /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
}

/** Whether to show the prompt again after the person dismissed it. */
export function snoozeExpired(dismissedAt: number | null, now: number): boolean {
  if (!dismissedAt || !Number.isFinite(dismissedAt)) return true;
  return now - dismissedAt > INSTALL_SNOOZE_DAYS * 86_400_000;
}
