// Writes the small local pages the Android app shows when it can't reach the website.
// Runs before `cap sync` (npm run android:sync). Needs CAPACITOR_SERVER_URL so "Try again" knows where to go.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const url = process.env.CAPACITOR_SERVER_URL?.replace(/\/$/, "");
if (!url) {
  console.error("Set CAPACITOR_SERVER_URL to the address of the web app, e.g.\n  CAPACITOR_SERVER_URL=https://your-app.vercel.app npm run android:sync");
  process.exit(1);
}
if (!/^https?:\/\//.test(url)) {
  console.error("CAPACITOR_SERVER_URL must start with https:// (or http:// for local development)");
  process.exit(1);
}
if (url.startsWith("http://") && !/^http:\/\/(10\.0\.2\.2|localhost|127\.0\.0\.1|192\.168\.)/.test(url)) {
  console.error("Plain http:// is only allowed for local development (10.0.2.2, localhost, 192.168.x.x).");
  process.exit(1);
}

mkdirSync("capacitor-web", { recursive: true });

// The same offline page the website uses, but "Try again" goes back to the site instead of reloading
const page = readFileSync("public/offline.html", "utf8").replace(
  'onclick="location.reload()"',
  `onclick="location.href='${url}/dashboard'"`
);
writeFileSync("capacitor-web/offline.html", page);
// index.html is only used if the app is built without a server URL; it points to the same page
writeFileSync("capacitor-web/index.html", page);
console.log(`Prepared capacitor-web for ${url}`);
