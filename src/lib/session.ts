import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";

export async function getSession() {
  const session = await auth();
  if (!session?.user) redirect("/login");
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
