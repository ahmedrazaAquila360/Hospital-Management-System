import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Images are resized and delivered by Cloudinary (src/lib/cloudinary-loader.ts),
    // not the hosting platform's optimizer, whose free quota broke them in production.
    loader: "custom",
    loaderFile: "./src/lib/cloudinary-loader.ts",
  },
  experimental: {
    serverActions: {
      // Uploads (documents, photos, logos) go through Server Actions, whose default
      // 1MB body limit rejected most PDFs. Matches MAX_UPLOAD_BYTES (10MB) in
      // src/lib/storage.ts plus room for multipart overhead.
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
