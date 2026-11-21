"use client";

import { withTransforms } from "@/lib/cloudinary";

/**
 * next/image loader (see `images.loaderFile` in next.config.ts): Cloudinary picks
 * the format and resizes to the requested width, instead of the platform's
 * optimizer. Images that are not on Cloudinary are served as-is.
 */
export default function cloudinaryLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  return withTransforms(src, `f_auto,c_limit,w_${width},q_${quality ?? "auto"}`);
}
