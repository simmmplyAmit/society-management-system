// Private object storage on Cloudflare R2 (S3-compatible). Files are never public: the app hands
// out short-lived signed links after checking who is asking.
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("STORAGE_NOT_CONFIGURED");
  }
}

let cached: { client: S3Client; bucket: string } | null = null;

function conn() {
  if (cached) return cached;
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) throw new StorageNotConfiguredError();
  cached = {
    bucket: R2_BUCKET,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
      // R2 rejects the extra checksum headers newer SDK versions add by default
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    }),
  };
  return cached;
}

export function storageConfigured(): boolean {
  try {
    conn();
    return true;
  } catch {
    return false;
  }
}

/** A link the browser can PUT the file to. The type and exact size are part of the signature. */
export async function signUpload(key: string, contentType: string, size: number): Promise<string> {
  const { client, bucket } = conn();
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: size }),
    { expiresIn: 300 }
  );
}

/** A link valid for 60 seconds. */
export async function signDownload(
  key: string,
  opts: { fileName: string; contentType: string; attachment: boolean }
): Promise<string> {
  const { client, bucket } = conn();
  const encoded = encodeURIComponent(opts.fileName);
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentType: opts.contentType,
      ResponseContentDisposition: `${opts.attachment ? "attachment" : "inline"}; filename*=UTF-8''${encoded}`,
    }),
    { expiresIn: 60 }
  );
}

/** Size of the stored file and its first bytes (to check what it really is). Null if missing. */
export async function inspectObject(key: string): Promise<{ size: number; head: Uint8Array } | null> {
  const { client, bucket } = conn();
  try {
    const h = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    const g = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: "bytes=0-15" }));
    const head = g.Body ? await g.Body.transformToByteArray() : new Uint8Array();
    return { size: Number(h.ContentLength ?? 0), head };
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === "NotFound" || name === "NoSuchKey") return null;
    throw err;
  }
}

export async function deleteObject(key: string): Promise<void> {
  const { client, bucket } = conn();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
