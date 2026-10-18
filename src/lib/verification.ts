import type { Role } from "@prisma/client";

export interface VerificationState {
  role: Role;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
}

/** Verification can be switched off (e.g. before email/SMS providers are configured). */
export function verificationRequired(): boolean {
  return process.env.REQUIRE_VERIFICATION !== "false";
}

/** True when the user may use the app: both contacts verified, or exempt. */
export function isFullyVerified(user: VerificationState): boolean {
  if (!verificationRequired()) return true;
  if (user.role === "SUPER_ADMIN") return true; // platform team, bootstrapped from env
  return Boolean(user.emailVerifiedAt && user.phoneVerifiedAt);
}
