// Encrypts (or re-encrypts with the current key) the sensitive columns already in the database.
//
//   FIELD_ENCRYPTION_KEY=… DATABASE_URL=… npx tsx scripts/encrypt-fields.ts --dry-run
//   FIELD_ENCRYPTION_KEY=… DATABASE_URL=… npx tsx scripts/encrypt-fields.ts
//
// Safe to run repeatedly: values already encrypted with the current key are skipped. After rotating
// the key, set FIELD_ENCRYPTION_KEY to the new key and FIELD_ENCRYPTION_KEY_PREVIOUS to the old one,
// run this, then drop the old key once it reports nothing left to do.
import { unsafeRawPrisma as db } from "../src/lib/prisma";
import { ENCRYPTED_FIELDS, currentKeyId, decryptValue, encryptValue, isEncrypted, keyIdOf } from "../src/lib/field-encryption";

const dryRun = process.argv.includes("--dry-run");
const BATCH = 200;

type Delegate = {
  findMany(args: object): Promise<{ id: string }[]>;
  update(args: object): Promise<unknown>;
};

async function main() {
  const kid = currentKeyId();
  if (!kid) {
    console.error("FIELD_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32");
    process.exit(1);
  }
  console.log(`${dryRun ? "[dry run] " : ""}Encrypting with key ${kid}`);

  let total = 0;
  for (const [model, fields] of Object.entries(ENCRYPTED_FIELDS)) {
    const delegate = (db as unknown as Record<string, Delegate>)[model.charAt(0).toLowerCase() + model.slice(1)];
    for (const field of fields) {
      let changed = 0;
      let cursor: string | undefined;
      for (;;) {
        const rows = (await delegate.findMany({
          select: { id: true, [field]: true },
          orderBy: { id: "asc" },
          take: BATCH,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        })) as unknown as ({ id: string } & Record<string, string | null>)[];
        if (rows.length === 0) break;
        cursor = rows[rows.length - 1].id;

        for (const row of rows) {
          const stored = row[field];
          if (!stored) continue;
          if (isEncrypted(stored) && keyIdOf(stored) === kid) continue; // already current
          const plain = decryptValue(stored);
          const cipher = encryptValue(plain, `${model}.${field}`);
          if (decryptValue(cipher) !== plain) throw new Error(`Round-trip check failed for ${model}.${field} ${row.id}`);
          if (!dryRun) await delegate.update({ where: { id: row.id }, data: { [field]: cipher } });
          changed++;
        }
      }
      console.log(`${model}.${field}: ${changed} value${changed === 1 ? "" : "s"} ${dryRun ? "would be " : ""}encrypted`);
      total += changed;
    }
  }
  console.log(total === 0 ? "Nothing left to do." : dryRun ? `${total} value(s) to encrypt. Run without --dry-run to apply.` : `Done: ${total} value(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
