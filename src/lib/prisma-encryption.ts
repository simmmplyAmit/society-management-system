// Prisma extension: encrypts the columns listed in ENCRYPTED_FIELDS on every write and decrypts
// them on every read, so the rest of the app only ever sees plain values. Raw SQL ($queryRaw)
// is not covered, and encrypted columns cannot be used in `where` filters.
import { Prisma } from "@prisma/client";
import { decryptDeep, encryptWriteArgs } from "@/lib/field-encryption";

export const fieldEncryption = Prisma.defineExtension({
  name: "field-encryption",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        encryptWriteArgs(model, operation, args);
        return decryptDeep(await query(args));
      },
    },
  },
});
