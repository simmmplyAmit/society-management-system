import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const run = (env: Record<string, string>) => {
  try {
    execFileSync("node", ["scripts/prepare-capacitor-web.mjs"], { env: { ...process.env, CAPACITOR_SERVER_URL: "", ...env }, stdio: "pipe" });
    return { ok: true, out: "" };
  } catch (e) {
    return { ok: false, out: String((e as { stderr?: Buffer }).stderr ?? "") };
  }
};

describe("scripts/prepare-capacitor-web.mjs", () => {
  it("requires the server URL", () => {
    const r = run({});
    expect(r.ok).toBe(false);
    expect(r.out).toContain("CAPACITOR_SERVER_URL");
  });
  it("refuses a plain http URL for a real host", () => {
    const r = run({ CAPACITOR_SERVER_URL: "http://society.example.com" });
    expect(r.ok).toBe(false);
    expect(r.out).toContain("only allowed for local development");
  });
  it("refuses a URL that isn't http(s)", () => {
    expect(run({ CAPACITOR_SERVER_URL: "ftp://x" }).ok).toBe(false);
  });
  it("accepts https, and the emulator's local address", () => {
    expect(run({ CAPACITOR_SERVER_URL: "https://society.example.com" }).ok).toBe(true);
    expect(run({ CAPACITOR_SERVER_URL: "http://10.0.2.2:3000" }).ok).toBe(true);
    // the retry button goes back to the site, not to a reload of the local file
    expect(readFileSync("capacitor-web/offline.html", "utf8")).toContain("http://10.0.2.2:3000/dashboard");
  });
});

describe("Android shell configuration", () => {
  const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");

  it("blocks cleartext traffic and device backups in release builds", () => {
    expect(manifest).toContain('android:usesCleartextTraffic="false"');
    expect(manifest).toContain('android:allowBackup="false"');
  });
  it("allows http only in the debug overlay", () => {
    expect(readFileSync("android/app/src/debug/AndroidManifest.xml", "utf8")).toContain('android:usesCleartextTraffic="true"');
  });
  it("can open UPI apps and take photos", () => {
    expect(manifest).toMatch(/<queries>[\s\S]*android:scheme="upi"[\s\S]*<\/queries>/);
    expect(manifest).toContain("android.permission.CAMERA");
    expect(manifest).toContain('android:required="false"'); // phones without a camera can still install it
  });
  it("asks for no more permissions than it needs", () => {
    const perms = [...manifest.matchAll(/uses-permission android:name="([^"]+)"/g)].map((m) => m[1]).sort();
    expect(perms).toEqual(["android.permission.CAMERA", "android.permission.INTERNET"]);
  });
  it("keeps signing secrets out of Git", () => {
    const ignore = readFileSync("android/.gitignore", "utf8");
    expect(ignore).toMatch(/^keystore\.properties$/m);
    expect(ignore).toMatch(/^\*\.jks$/m);
    expect(readFileSync("android/app/build.gradle", "utf8")).toContain("keystore.properties");
  });
  it("only downloads over http(s) in the native download handler", () => {
    const java = readFileSync("android/app/src/main/java/com/societyms/app/MainActivity.java", "utf8");
    expect(java).toContain('scheme.equals("https")');
    expect(java).toContain("setDownloadListener");
  });
  it("has launcher icons and a splash screen", () => {
    for (const f of [
      "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png",
      "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png",
      "android/app/src/main/res/drawable-port-xxxhdpi/splash.png",
    ]) expect(existsSync(f), f).toBe(true);
  });
  it("identifies itself to the website", () => {
    const cfg = readFileSync("capacitor.config.ts", "utf8");
    expect(cfg).toContain("SocietyMS-Android");
  });
});
