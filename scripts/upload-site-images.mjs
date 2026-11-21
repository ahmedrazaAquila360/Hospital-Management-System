// Uploads every public-site photo referenced as siteImage("<unsplash photo id>") in src/
// to Cloudinary (folder dentalhub/site), so the site never depends on the hosting
// platform's image-optimization quota. Safe to re-run: existing images are kept.
//
// Usage: node --env-file=.env.local scripts/upload-site-images.mjs
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = process.env;
if (!cloud || !apiKey || !apiSecret) {
  console.error("Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET (e.g. in .env.local).");
  process.exit(1);
}

const FOLDER = "dentalhub/site";
const root = path.resolve(new URL("..", import.meta.url).pathname, "src");

function* sourceFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* sourceFiles(p);
    else if (/\.(ts|tsx)$/.test(name)) yield p;
  }
}

const ids = new Set();
for (const file of sourceFiles(root)) {
  for (const m of readFileSync(file, "utf8").matchAll(/siteImage\("([0-9a-f-]+)"\)/g)) ids.add(m[1]);
}
console.log(`${ids.size} site images referenced`);

// Signed upload: SHA-1 of the sorted signed params followed by the API secret.
function sign(params) {
  const base = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  return createHash("sha1").update(base + apiSecret).digest("hex");
}

let uploaded = 0;
let existing = 0;
for (const id of ids) {
  const params = { overwrite: "false", public_id: `${FOLDER}/photo-${id}`, timestamp: Math.floor(Date.now() / 1000) };
  const body = new FormData();
  // Cloudinary fetches the original from Unsplash itself; 2400px is plenty for any layout here.
  body.set("file", `https://images.unsplash.com/photo-${id}?q=90&w=2400&auto=format&fm=jpg`);
  for (const [k, v] of Object.entries(params)) body.set(k, String(v));
  body.set("api_key", apiKey);
  body.set("signature", sign(params));
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: "POST", body });
  const json = await res.json();
  if (!res.ok) {
    console.error(`FAILED ${id}: ${json.error?.message ?? res.status}`);
    process.exitCode = 1;
    continue;
  }
  if (json.existing) existing++;
  else uploaded++;
  console.log(`${json.existing ? "exists  " : "uploaded"} ${json.public_id} (${json.width}x${json.height})`);
}
console.log(`done: ${uploaded} uploaded, ${existing} already on Cloudinary`);
