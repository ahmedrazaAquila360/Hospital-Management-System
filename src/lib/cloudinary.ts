/**
 * Public-site images are hosted on Cloudinary and resized there, so they never
 * depend on the hosting platform's image-optimization quota. The cloud name is
 * public (it appears in every image URL); upload credentials live only in
 * .env.local for scripts/upload-site-images.mjs.
 */
export const CLOUDINARY_CLOUD_NAME = "tqlq8hod";
export const SITE_IMAGE_FOLDER = "dentalhub/site";

const UPLOAD_BASE = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/`;

/** Delivery URL for a site image uploaded by scripts/upload-site-images.mjs (keyed by its Unsplash photo id). */
export function siteImage(photoId: string) {
  return `${UPLOAD_BASE}${SITE_IMAGE_FOLDER}/photo-${photoId}`;
}

/** Inserts Cloudinary transformations into one of our delivery URLs; other URLs are returned unchanged. */
export function withTransforms(src: string, transforms: string) {
  return src.startsWith(UPLOAD_BASE) ? `${UPLOAD_BASE}${transforms}/${src.slice(UPLOAD_BASE.length)}` : src;
}
