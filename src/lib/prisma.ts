import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { fieldEncryption } from "@/lib/prisma-encryption";

function createBaseClient() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function createPrismaClient() {
  // Sensitive columns (see src/lib/field-encryption.ts) are encrypted on write and decrypted on read
  return createBaseClient().$extends(fieldEncryption);
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

/** The client without encryption: only for the migration script that re-encrypts stored values. */
export const unsafeRawPrisma = createBaseClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** The transaction client inside `prisma.$transaction(async (tx) => …)` (encryption included). */
export type DbTransaction = Omit<
  ReturnType<typeof createPrismaClient>,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;
