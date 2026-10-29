// Version of the privacy notice people agree to, and who to contact about it.
// Bump PRIVACY_VERSION whenever the notice changes in a way people should re-accept: everyone is
// asked to agree again on their next visit.
import type { Role } from "@prisma/client";

export const PRIVACY_VERSION = "2026-10-30";
export const PRIVACY_UPDATED = "30 October 2026";

export interface PrivacyOperator {
  name: string;
  email: string | null;
  grievanceOfficer: string | null;
  address: string | null;
}

/** Contact details come from the environment so they can be set without a code change. */
export function getPrivacyOperator(): PrivacyOperator {
  return {
    name: process.env.PRIVACY_OPERATOR_NAME?.trim() || "the Society MS team",
    email: process.env.PRIVACY_CONTACT_EMAIL?.trim() || null,
    grievanceOfficer: process.env.PRIVACY_GRIEVANCE_OFFICER?.trim() || null,
    address: process.env.PRIVACY_POSTAL_ADDRESS?.trim() || null,
  };
}

/** True when the person still has to agree to the current notice. The platform team is exempt. */
export function needsConsent(user: { role: Role; privacyVersion: string | null }): boolean {
  if (user.role === "SUPER_ADMIN") return false;
  return user.privacyVersion !== PRIVACY_VERSION;
}

export const CONSENT_STATEMENT =
  "I have read the Privacy Notice and I agree to my details being used as it describes.";

export const REQUEST_NOTE_MAX = 500;
