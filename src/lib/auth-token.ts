import type { Role } from "@prisma/client";
import { isFullyVerified } from "@/lib/verification";

/** How often (ms) a JWT is re-checked against the database. */
export const REVALIDATE_MS = 5 * 60 * 1000;

export interface TokenUserState {
  isActive: boolean;
  role: Role;
  societyId: string | null;
  emailVerifiedAt?: Date | null;
  phoneVerifiedAt?: Date | null;
}

interface RefreshableToken {
  id?: string;
  role?: Role;
  societyId?: string | null;
  verified?: boolean;
  checkedAt?: number;
  [key: string]: unknown;
}

/**
 * Re-validates a JWT against the database at most every REVALIDATE_MS.
 * Returns null (=> session invalidated) when the user was deleted or deactivated,
 * and refreshes role / societyId / verification so admin changes take effect without re-login.
 */
export async function refreshToken<T extends RefreshableToken>(
  token: T,
  now: number,
  fetchUser: (id: string) => Promise<TokenUserState | null>
): Promise<T | null> {
  if (!token.id) return token;
  if (token.checkedAt && now - token.checkedAt < REVALIDATE_MS) return token;

  const user = await fetchUser(token.id);
  if (!user || !user.isActive) return null;

  const verified = isFullyVerified({
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    phoneVerifiedAt: user.phoneVerifiedAt ?? null,
  });
  return { ...token, role: user.role, societyId: user.societyId, verified, checkedAt: now };
}
