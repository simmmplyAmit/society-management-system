// Business details shown on the public website and in the policies.
// Values in [square brackets] are placeholders: fill them in before launch
// (Meta and Razorpay check these pages during business verification).

export const SITE = {
  brand: "Society MS",
  tagline: "Housing society management without registers or spreadsheets",

  /** Registered business name, e.g. the proprietor's trade name or "XYZ Technologies Pvt Ltd". */
  legalName: "[Legal business name]",
  /** Registered address, shown on Contact and in the policies. */
  address: "[Registered address, City, State, PIN]",
  /** City whose courts have jurisdiction under the Terms. */
  jurisdictionCity: "[City]",
  /** GSTIN once registered; leave null to hide it. */
  gstin: null as string | null,

  contactEmail: "hello@[your-domain]",
  supportEmail: "support@[your-domain]",
  /** Grievance Officer under the IT Rules / DPDP Act: a named person and an email. */
  grievanceOfficer: { name: "[Name]", email: "grievance@[your-domain]" },
  /** WhatsApp number with country code, digits only (e.g. "919876543210"); null hides the button. */
  whatsapp: null as string | null,

  /** Date the current versions of the policies took effect. Change it whenever a policy changes. */
  policiesUpdated: "29 October 2026",

  pricing: {
    /** Price per flat per month in rupees; null shows the free-pilot offer instead. */
    perFlatMonthly: null as number | null,
    /** Notice given before a free society is moved to a paid plan, or before a price change. */
    noticeDays: 30,
  },
} as const;

export function contactHref(subject = `${SITE.brand} demo request`) {
  return `mailto:${SITE.contactEmail}?subject=${encodeURIComponent(subject)}`;
}

export function whatsappHref(text = `Hi, I'd like a demo of ${SITE.brand} for our society.`) {
  return SITE.whatsapp ? `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(text)}` : null;
}

/** Public pages: listed in the sitemap and reachable without signing in (see src/proxy.ts). */
export const PUBLIC_PAGES = [
  { href: "/", label: "Home" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/refund-policy", label: "Refund & Cancellation" },
] as const;
