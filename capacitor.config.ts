import type { CapacitorConfig } from "@capacitor/cli";

// The Android app is a thin native shell around the hosted web app. It loads CAPACITOR_SERVER_URL
// (your production site, or http://10.0.2.2:3000 for the emulator against a local `npm run dev`),
// so the app needs no rebuild or store update when the website changes.
//   CAPACITOR_SERVER_URL=https://your-app.vercel.app npm run android:sync
const serverUrl = process.env.CAPACITOR_SERVER_URL?.replace(/\/$/, "");

const config: CapacitorConfig = {
  appId: "com.societyms.app", // permanent once published on the Play Store: choose it before the first upload
  appName: "Society MS",
  webDir: "capacitor-web", // only holds the offline/error page (see scripts/prepare-capacitor-web.mjs)
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: serverUrl.startsWith("http://"), // local development only
          androidScheme: "https",
          errorPath: "offline.html", // shown when the site can't be reached
          // Anything on another host (UPI apps, signed file links) opens outside the app on purpose
        },
      }
    : {}),
  android: {
    // Lets the website know it runs inside the app (hides the install prompt, etc.)
    appendUserAgent: "SocietyMS-Android/1",
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#f5f6fa",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#4f46e5",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    SystemBars: {
      // The website sets viewport-fit=cover and pads itself with env(safe-area-inset-*)
      insetsHandling: "native",
      initialViewportFitValueHint: "cover",
      style: "LIGHT", // dark icons on the app's white top bar
    },
  },
};

export default config;
