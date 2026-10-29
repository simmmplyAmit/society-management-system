"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LOCALE_COOKIE, LOCALES } from "@/i18n/config";

const localeSchema = z.object({ locale: z.enum(LOCALES) });

/**
 * Sets the app language. Open to everyone, signed in or not (the sign-in page has a switcher):
 * it only sets the caller's own cookie and, when signed in, the caller's own saved choice,
 * which also decides the language of the emails they receive.
 */
export async function setLocale(formData: FormData) {
  const parsed = localeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Unsupported language" };
  const { locale } = parsed.data;

  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  const session = await auth();
  if (session?.user?.id) {
    await prisma.user.updateMany({ where: { id: session.user.id }, data: { locale } });
  }
  return { success: true as const };
}
