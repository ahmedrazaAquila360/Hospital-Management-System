/**
 * Client-side mirror of the server's image rules (ALLOWED_IMAGE_TYPES / MAX_UPLOAD_BYTES in
 * src/lib/storage.ts, which is server-only), so a bad file is rejected the moment it is
 * picked instead of after a full form submit. The server still enforces both.
 */
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const IMAGE_TYPES = IMAGE_ACCEPT.split(",");
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_HINT = "JPG, PNG or WebP · up to 10 MB";

/** Returns a user-facing error, or null when the file is acceptable. */
export function imageFileError(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return "Please choose a JPG, PNG or WebP image.";
  if (file.size > MAX_IMAGE_BYTES) return "Image must be under 10 MB.";
  return null;
}
