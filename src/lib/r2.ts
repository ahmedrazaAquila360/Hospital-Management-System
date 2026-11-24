import "server-only";
import { validateFileContents, MAX_UPLOAD_BYTES } from "@/lib/storage";
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
 * Vercel Blob or /uploads URLs and require migration before access.
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
export async function createDocumentUpload(filename: string, contentType: string, ownerId: string) {
  const ext = path.extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, "");
  const key = `documents/staging/${ownerId}/${randomBytes(16).toString("hex")}${ext}`;
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

export function isOwnedStagingKey(key: string, ownerId: string) {
  return key.startsWith(`documents/staging/${ownerId}/`) && /^documents\/staging\/[a-zA-Z0-9_-]+\/[0-9a-f]{32}(\.[a-z0-9]+)?$/.test(key);
}

/** Validate bytes, then write a new immutable key that the browser cannot overwrite. */
export async function finalizeDocumentUpload(key: string, ownerId: string) {
  if (!isOwnedStagingKey(key, ownerId)) throw new Error("Invalid upload owner.");
  const head = await headDocument(key);
  if (!head || head.size <= 0 || head.size > MAX_UPLOAD_BYTES) throw new Error("Invalid file size.");
  const object = await r2().send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key, Range: `bytes=0-${MAX_UPLOAD_BYTES}` }));
  if (!object.Body) throw new Error("Upload not found.");
  const bytes = Buffer.from(await object.Body.transformToByteArray());
  const format = validateFileContents(bytes, head.contentType, "documents");
  const finalKey = `documents/${randomBytes(16).toString("hex")}.${format.ext}`;
  await r2().send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: finalKey, Body: bytes, ContentType: format.mime }));
  await deleteDocumentObject(key);
  return { key: finalKey, size: bytes.length, contentType: format.mime };
}
