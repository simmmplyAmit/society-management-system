import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      image?: string | null;
      role: Role;
      societyId: string | null;
      verified: boolean;
    };
  }

  interface User {
    role: Role;
    societyId: string | null;
    verified?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    societyId: string | null;
    verified?: boolean;
    checkedAt?: number;
  }
}
