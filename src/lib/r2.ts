import "server-only";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Patient documents (X-rays, reports, scans) live in a private Cloudflare R2
 * bucket. Browsers upload straight to R2 with a short-lived signed URL, so files
 * never pass through the hosting platform's request-size limit, and are only
 * readable through /documents/[id]/file, which checks the session first.
 *
 * Document.fileUrl holds `r2:<key>` for these files; older documents keep their
 * Vercel Blob or /uploads URLs and are served as before.
 */
export const R2_URL_PREFIX = "r2:";

const { HOSPITAL_R2_ACCOUNT_ID: R2_ACCOUNT_ID, HOSPITAL_R2_ACCESS_KEY_ID: R2_ACCESS_KEY_ID, HOSPITAL_R2_SECRET_ACCESS_KEY: R2_SECRET_ACCESS_KEY, HOSPITAL_R2_BUCKET: R2_BUCKET } = process.env;

export function isR2Configured() {
  return Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET);
}

let client: S3Client | undefined;
function r2() {
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID!, secretAccessKey: R2_SECRET_ACCESS_KEY! },
  });
  return client;
}

const KEY_PATTERN = /^documents\/[0-9a-f]{32}(\.[a-z0-9]+)?$/;

export function isDocumentKey(key: string) {
  return KEY_PATTERN.test(key);
}

export function r2KeyFromFileUrl(fileUrl: string) {
  return fileUrl.startsWith(R2_URL_PREFIX) ? fileUrl.slice(R2_URL_PREFIX.length) : null;
}

/** Signed PUT URL (10 minutes) for one new document; the browser must send the same Content-Type. */
export async function createDocumentUpload(filename: string, contentType: string) {
  const ext = path.extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, "");
  const key = `documents/${randomBytes(16).toString("hex")}${ext}`;
  const url = await getSignedUrl(r2(), new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }), {
    expiresIn: 600,
  });
  return { key, url };
}

/** Size and type of an uploaded object, or null if the browser never finished the upload. */
export async function headDocument(key: string) {
  try {
    const head = await r2().send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return { size: head.ContentLength ?? 0, contentType: head.ContentType ?? "" };
  } catch {
    return null;
  }
}

/** Signed GET URL (5 minutes) that previews inline or downloads under `filename`. */
export async function documentDownloadUrl(key: string, filename: string, download: boolean) {
  const encoded = encodeURIComponent(filename);
  return getSignedUrl(
    r2(),
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ResponseContentDisposition: `${download ? "attachment" : "inline"}; filename*=UTF-8''${encoded}`,
    }),
    { expiresIn: 300 }
  );
}

export async function deleteDocumentObject(key: string) {
  await r2().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}
