// Generates every icon and splash image from one drawing (the Society MS building mark).
//   node scripts/generate-icons.mjs
// Outputs: public/icons/*, src/app/icon.svg, src/app/apple-icon.png, src/app/favicon.ico (web and PWA)
// and assets/* (sources for `npx capacitor-assets generate --android`).
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";

const INDIGO = "#4f46e5";
const VIOLET = "#6d28d9";

// lucide "building-2" (24 x 24 grid), drawn as white strokes
const GLYPH = `
  <path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/>
  <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/>
  <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/>`;

const gradient = (id) =>
  `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${INDIGO}"/><stop offset="1" stop-color="${VIOLET}"/></linearGradient></defs>`;

/** The mark centred on a square canvas; `glyph` is the fraction of the canvas it may fill. */
function glyphAt(size, glyph) {
  const px = size * glyph;
  const s = px / 24;
  const o = (size - px) / 2;
  return `<g transform="translate(${o} ${o}) scale(${s})" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${GLYPH}</g>`;
}

const svg = (size, inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${inner}</svg>`;

/** Rounded-square tile with the mark: for "any" icons. */
const tile = (size, radius = 0.22, glyph = 0.56) =>
  svg(size, `${gradient("g")}<rect width="${size}" height="${size}" rx="${size * radius}" fill="url(#g)"/>${glyphAt(size, glyph)}`);

/** Full-bleed gradient: maskable and iOS icons (the system applies its own shape). */
const fullBleed = (size, glyph) => svg(size, `${gradient("g")}<rect width="${size}" height="${size}" fill="url(#g)"/>${glyphAt(size, glyph)}`);

const png = (data, size, file) => sharp(Buffer.from(data)).resize(size, size).png().toFile(file);

mkdirSync("public/icons", { recursive: true });
mkdirSync("assets", { recursive: true });

// ── Web / PWA ──
await png(tile(512), 192, "public/icons/icon-192x192.png");
await png(tile(512), 512, "public/icons/icon-512x512.png");
// maskable: the mark must stay inside the central 80% circle, so keep it to ~46%
await png(fullBleed(512, 0.46), 512, "public/icons/icon-maskable-512x512.png");
await png(fullBleed(512, 0.46), 192, "public/icons/icon-maskable-192x192.png");
await png(fullBleed(512, 0.5), 180, "src/app/apple-icon.png");
writeFileSync("src/app/icon.svg", tile(512));

// favicon.ico: an ICO container holding a 48px PNG
const fav = await sharp(Buffer.from(tile(512, 0.2, 0.6))).resize(48, 48).png().toBuffer();
const ico = Buffer.alloc(22 + fav.length);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4); // header: 1 image
ico.writeUInt8(48, 6); ico.writeUInt8(48, 7); ico.writeUInt8(0, 8); ico.writeUInt8(0, 9);
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(fav.length, 14); ico.writeUInt32LE(22, 18);
fav.copy(ico, 22);
writeFileSync("src/app/favicon.ico", ico);

// ── Capacitor (Android adaptive icon + splash) ──
await png(tile(1024, 0.0, 0.5), 1024, "assets/icon-only.png");
// foreground: transparent, mark inside the 66% safe zone of the adaptive icon
await png(svg(1024, glyphAt(1024, 0.42)), 1024, "assets/icon-foreground.png");
// background layer is the plain gradient (no mark)
await png(svg(1024, `${gradient("g")}<rect width="1024" height="1024" fill="url(#g)"/>`), 1024, "assets/icon-background.png");
const splash = (bg) => svg(2732, `${bg}${glyphAt(2732, 0.2)}`);
await png(splash(`${gradient("g")}<rect width="2732" height="2732" fill="url(#g)"/>`), 2732, "assets/splash.png");
await png(splash(`<rect width="2732" height="2732" fill="#111827"/>`), 2732, "assets/splash-dark.png");

console.log("Icons generated.");
