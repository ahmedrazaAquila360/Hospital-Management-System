// Downloads only the BodyParts3D 3.0 meshes the dental chart needs (≈5 MB of a 521 MB
// archive) using HTTP range requests, verifies each file's CRC, and writes them to
// assets-src/bodyparts3d/ with SOURCE.json (URL, licence, attribution, checksums).
//
// Licence of the data: CC BY-SA 2.1 Japan — "BodyParts3D, Copyright© The Database
// Center for Life Science licensed by CC Attribution-Share Alike 2.1 Japan".
//
// Usage: node scripts/fetch-bodyparts3d.mjs
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { crc32, inflateRawSync } from "node:zlib";

const BASE = "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20110915/";
const ZIP = `${BASE}BodyParts3D_3.0_obj_95.zip`;
const OUT = "assets-src/bodyparts3d";

const WANTED = {
  FMA52748: "mandible",
  FMA53649: "right maxilla",
  FMA53650: "left maxilla",
  FMA59763: "gingiva of upper jaw",
  FMA59764: "gingiva of lower jaw",
};
for (const id of [
  55680, 55681, 55682, 55683, 55686, 55687, 55688, 55689, 55690, 55691, 55692, 55693, 55694, 55695, 55697, 55698,
  55699, 55700, 55703, 55704, 55705, 55706, 55798, 55799, 57140, 57141, 57142, 57143,
]) {
  WANTED[`FMA${id}`] = "permanent tooth";
}

async function range(start, end) {
  const res = await fetch(ZIP, { headers: { Range: `bytes=${start}-${end}` } });
  if (res.status !== 206) throw new Error(`Range request failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const size = Number((await fetch(ZIP, { method: "HEAD" })).headers.get("content-length"));
const tail = await range(size - 70000, size - 1);
const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
const cdSize = tail.readUInt32LE(eocd + 12);
const cdOffset = tail.readUInt32LE(eocd + 16);
const cd = await range(cdOffset, cdOffset + cdSize - 1);

await mkdir(OUT, { recursive: true });
const files = {};
for (let p = 0; p < cd.length; ) {
  const method = cd.readUInt16LE(p + 10);
  const crc = cd.readUInt32LE(p + 16);
  const compressed = cd.readUInt32LE(p + 20);
  const nameLen = cd.readUInt16LE(p + 28);
  const extraLen = cd.readUInt16LE(p + 30);
  const commentLen = cd.readUInt16LE(p + 32);
  const offset = cd.readUInt32LE(p + 42);
  const name = cd.subarray(p + 46, p + 46 + nameLen).toString();
  p += 46 + nameLen + extraLen + commentLen;

  const id = name.replace(/\\/g, "/").split("/").pop().replace(/\.obj$/, "");
  if (!WANTED[id]) continue;
  const header = await range(offset, offset + 29);
  const dataStart = offset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
  const data = await range(dataStart, dataStart + compressed - 1);
  const raw = method === 8 ? inflateRawSync(data) : data;
  if (crc32(raw) >>> 0 !== crc) throw new Error(`CRC mismatch for ${id}`);
  await writeFile(`${OUT}/${id}.obj`, raw);
  files[id] = { name: WANTED[id], sha256: createHash("sha256").update(raw).digest("hex"), bytes: raw.length };
}

const missing = Object.keys(WANTED).filter((id) => !files[id]);
if (missing.length) throw new Error(`Not found in archive: ${missing.join(", ")}`);
await writeFile(
  `${OUT}/SOURCE.json`,
  JSON.stringify(
    {
      source: ZIP,
      release: "BodyParts3D 3.0 (2011-09-15), 95% polygon reduction",
      license: "CC BY-SA 2.1 Japan",
      attribution: "BodyParts3D, Copyright© The Database Center for Life Science licensed by CC Attribution-Share Alike 2.1 Japan",
      files,
    },
    null,
    1
  )
);
console.log(`fetched ${Object.keys(files).length} meshes into ${OUT}`);
