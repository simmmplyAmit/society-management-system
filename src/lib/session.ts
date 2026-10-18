import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isFullyVerified } from "@/lib/verification";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";

/** Signed-in session without the verification gate. Only for /verify and its actions. */
export async function getSessionUnverified() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

/**
 * Sends users who haven't verified email + mobile to /verify. The token flag is
 * refreshed every few minutes, so unverified users are re-checked against the
 * database to avoid a bounce right after they finish verifying.
 */
export async function ensureVerified(session: { user: { id: string; verified: boolean } }) {
  if (session.user.verified) return;
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, emailVerifiedAt: true, phoneVerifiedAt: true },
  });
  if (!u || !isFullyVerified(u)) redirect("/verify");
}

export async function getSession() {
  const session = await getSessionUnverified();
  await ensureVerified(session);
  return session;
}

export async function requireRole(allowed: Role[]) {
  const session = await getSession();
  if (!allowed.includes(session.user.role)) {
    redirect("/dashboard");
  }
  return session;
}

export async function requireSociety() {
  const session = await getSession();
  if (!session.user.societyId) redirect("/dashboard");
  return { session, societyId: session.user.societyId as string };
}
