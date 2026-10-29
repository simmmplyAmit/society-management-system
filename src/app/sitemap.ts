import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/notify/templates";
import { PUBLIC_PAGES } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  return PUBLIC_PAGES.map((p) => ({ url: `${base}${p.href === "/" ? "" : p.href}` }));
}
