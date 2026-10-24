import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { refreshToken } from "@/lib/auth-token";
import { isRateLimited, recordFailure, resetAttempts } from "@/lib/rate-limit";
import { isFullyVerified } from "@/lib/verification";
import type { Role } from "@prisma/client";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        if (isRateLimited(email)) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            role: true,
            societyId: true,
            isActive: true,
            avatarUrl: true,
            emailVerifiedAt: true,
            phoneVerifiedAt: true,
          },
        });

        if (!user || !user.isActive) {
          recordFailure(email);
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          recordFailure(email);
          return null;
        }
        resetAttempts(email);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          societyId: user.societyId,
          image: user.avatarUrl,
          verified: isFullyVerified(user),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: Role }).role;
        token.societyId = (user as { societyId: string | null }).societyId;
        token.verified = (user as { verified?: boolean }).verified ?? false;
        token.checkedAt = Date.now();
        return token;
      }
      // Periodically re-check the user: deactivated/deleted users lose their session
      return refreshToken(token, Date.now(), (id) =>
        prisma.user.findUnique({
          where: { id },
          select: {
            isActive: true, role: true, societyId: true,
            emailVerifiedAt: true, phoneVerifiedAt: true,
          },
        })
      );
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.societyId = token.societyId as string | null;
        session.user.verified = Boolean(token.verified);
      }
      return session;
    },
  },
});
