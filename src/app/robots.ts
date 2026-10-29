import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/notify/templates";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/super-admin", "/verify", "/api/"] },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
