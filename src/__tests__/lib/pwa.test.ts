import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { INSTALL_SNOOZE_DAYS, installPlatform, isIosSafari, isNativeShell, snoozeExpired } from "@/lib/utils/pwa";

const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

describe("platform detection", () => {
  it("recognises the native shell by its user-agent marker", () => {
    expect(isNativeShell(`${ANDROID_CHROME} SocietyMS-Android/1.0`)).toBe(true);
    expect(isNativeShell(ANDROID_CHROME)).toBe(false);
  });
  it("tells phones from desktops", () => {
    expect(installPlatform(ANDROID_CHROME)).toBe("android");
    expect(installPlatform(IPHONE_SAFARI)).toBe("ios");
    expect(installPlatform(DESKTOP)).toBe("other");
  });
  it("only offers Add to Home Screen instructions in iPhone Safari", () => {
    expect(isIosSafari(IPHONE_SAFARI)).toBe(true);
    expect(isIosSafari(IPHONE_CHROME)).toBe(false);
    expect(isIosSafari(ANDROID_CHROME)).toBe(false);
  });
});

describe("snoozeExpired", () => {
  const now = Date.UTC(2026, 9, 29);
  it("shows the prompt when it was never dismissed", () => {
    expect(snoozeExpired(null, now)).toBe(true);
    expect(snoozeExpired(Number.NaN, now)).toBe(true);
  });
  it("waits out the snooze period", () => {
    expect(snoozeExpired(now - 2 * 86_400_000, now)).toBe(false);
    expect(snoozeExpired(now - (INSTALL_SNOOZE_DAYS + 1) * 86_400_000, now)).toBe(true);
  });
});

describe("web app manifest", () => {
  const manifest = JSON.parse(readFileSync("public/manifest.json", "utf8"));

  it("has what installability needs", () => {
    expect(manifest).toMatchObject({ display: "standalone", scope: "/", lang: "en-IN" });
    expect(manifest.name).toBeTruthy();
    expect(manifest.start_url).toMatch(/^\/dashboard/);
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("lists 192 and 512 icons, including separate maskable ones that exist on disk", () => {
    const sizes = (purpose: string) => manifest.icons.filter((i: { purpose: string }) => i.purpose === purpose).map((i: { sizes: string }) => i.sizes);
    expect(sizes("any")).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(sizes("maskable")).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const icon of manifest.icons) {
      const file = `public${icon.src}`;
      expect(existsSync(file), file).toBe(true);
      // PNG header: width and height are big-endian ints at byte 16 and 20
      const buf = readFileSync(file);
      const [w, h] = icon.sizes.split("x").map(Number);
      expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([w, h]);
    }
  });

  it("does not mix 'any' and 'maskable' on one icon (they need different artwork)", () => {
    for (const icon of manifest.icons) expect(icon.purpose).not.toContain(" ");
  });

  it("has shortcuts that stay inside the app", () => {
    expect(manifest.shortcuts.length).toBeGreaterThan(0);
    for (const s of manifest.shortcuts) expect(s.url).toMatch(/^\/dashboard/);
  });
});
