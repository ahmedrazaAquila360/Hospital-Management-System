// Builds public/models/mouth-realistic.glb — the dental chart's "Realistic mouth" model —
// following the 3D model contract in docs/dental-3d-model-spec.md.
//
// Source: "Human teeth" by Alexander Antipov (Sketchfab @Dessen), licensed under
// CC Attribution 4.0: https://sketchfab.com/3d-models/human-teeth-c4c569f0e08948e2a572007a7a5726f2
// The output is a modified version (see public/models/LICENSE-mouth-realistic.txt).
//
// Input: assets-src/realistic-mouth/human_teeth.glb (git-ignored) — Sketchfab's
// "GLB, 2k textures" download. It has one textured mesh with 32 separate crowns and one
// for the gums, palate and tongue, posed with the mouth closed.
//
// Usage: pnpm exec tsx scripts/build-realistic-mouth.mts
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import * as THREE from "three";
import { Document, Logger, NodeIO, type Texture } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsClearcoat } from "@gltf-transform/extensions";
import { dedup, meshopt, prune } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import { toothSpec } from "../src/components/dental-chart/three/tooth-geometry";

const SRC = "assets-src/realistic-mouth/human_teeth.glb";
const OUT = "public/models/mouth-realistic.glb";

// Source units → millimetres, from typical crown widths (upper central incisor ≈ 8.5mm,
// first molars ≈ 10–11mm) against the model's crowns.
const MM_PER_UNIT = 7;
// Gap between the upper and lower incisal edges once the jaw is opened for inspection.
const TARGET_GAP = 14;

// sharp ships with Next.js; resolve it from there rather than adding a dependency.
const require = createRequire(import.meta.url);
type Sharp = (input: Buffer) => { jpeg(o: { quality: number; mozjpeg: boolean }): { toBuffer(): Promise<Buffer> } };
const sharp = createRequire(require.resolve("next/package.json"))("sharp") as Sharp;

const isUpper = (n: number) => Math.floor(n / 10) <= 2;

// ---------------------------------------------------------------------------
// Read the source: geometry baked to world space, tangents dropped (three.js derives
// the normal-map basis per pixel), textures kept for re-encoding.
// ---------------------------------------------------------------------------
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const src = await io.read(SRC);

function geometryOf(meshName: string) {
  const node = src.getRoot().listNodes().find((n) => n.getMesh()?.getName() === meshName);
  if (!node) throw new Error(`${meshName} not found in ${SRC}`);
  const prim = node.getMesh()!.listPrimitives()[0];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(prim.getAttribute("POSITION")!.getArray()!), 3));
  g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(prim.getAttribute("NORMAL")!.getArray()!), 3));
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(prim.getAttribute("TEXCOORD_0")!.getArray()!), 2));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(prim.getIndices()!.getArray()!), 1));
  g.applyMatrix4(new THREE.Matrix4().fromArray(node.getWorldMatrix()));
  return { geometry: g, material: prim.getMaterial()! };
}
const teethSrc = geometryOf("Teeth_TeethMaterial_0");
const gumsSrc = geometryOf("Gums_GumsMaterial_0");
const toMm = new THREE.Matrix4().makeScale(MM_PER_UNIT, MM_PER_UNIT, MM_PER_UNIT);
teethSrc.geometry.applyMatrix4(toMm);
gumsSrc.geometry.applyMatrix4(toMm);

/** A new geometry holding only the given triangles (vertices compacted). */
function subset(geo: THREE.BufferGeometry, triangles: number[]) {
  const idx = geo.index!.array;
  const remap = new Map<number, number>();
  const out: number[] = [];
  for (const t of triangles) {
    for (let k = 0; k < 3; k++) {
      const v = idx[t * 3 + k];
      if (!remap.has(v)) remap.set(v, remap.size);
      out.push(remap.get(v)!);
    }
  }
  const g = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "uv"]) {
    const a = geo.getAttribute(name);
    const arr = new Float32Array(remap.size * a.itemSize);
    for (const [from, to] of remap) for (let c = 0; c < a.itemSize; c++) arr[to * a.itemSize + c] = a.array[from * a.itemSize + c];
    g.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(out), 1));
  return g;
}

/** Triangles grouped by connected surface (vertices split at UV seams are welded by position). */
function components(geo: THREE.BufferGeometry) {
  const pos = geo.attributes.position;
  const idx = geo.index!.array;
  const parent = Array.from({ length: pos.count }, (_, i) => i);
  const find = (a: number): number => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  const union = (a: number, b: number) => {
    a = find(a);
    b = find(b);
    if (a !== b) parent[a] = b;
  };
  const seen = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 1e3)},${Math.round(pos.getY(i) * 1e3)},${Math.round(pos.getZ(i) * 1e3)}`;
    const j = seen.get(k);
    if (j === undefined) seen.set(k, i);
    else union(i, j);
  }
  for (let t = 0; t < idx.length; t += 3) {
    union(idx[t], idx[t + 1]);
    union(idx[t], idx[t + 2]);
  }
  const groups = new Map<number, number[]>();
  for (let t = 0; t < idx.length / 3; t++) {
    const r = find(idx[t * 3]);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(t);
  }
  return [...groups.values()];
}

const centroid = (g: THREE.BufferGeometry) => {
  g.computeBoundingBox();
  return g.boundingBox!.getCenter(new THREE.Vector3());
};

// ---------------------------------------------------------------------------
// One geometry per crown, then sort them into jaws and FDI numbers.
// ---------------------------------------------------------------------------
const crowns = components(teethSrc.geometry).map((tris) => subset(teethSrc.geometry, tris));
if (crowns.length !== 32) throw new Error(`Expected 32 separate crowns, found ${crowns.length}`);

// The occlusal surface rises towards the back (curve of Spee + head pose): fit y = a + b·z
// through the crown centres. Crowns above the line are upper teeth.
const centres = crowns.map(centroid);
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const mz = mean(centres.map((c) => c.z));
const my = mean(centres.map((c) => c.y));
const slope =
  centres.reduce((s, c) => s + (c.z - mz) * (c.y - my), 0) / centres.reduce((s, c) => s + (c.z - mz) ** 2, 0);
const planeY = (z: number) => my + slope * (z - mz);

// Front of the mouth is +Z and up is +Y, so the patient's left is +X (the chart's axes).
// Order each quadrant from the midline back by angle around the back of the arch.
const backZ = Math.min(...centres.map((c) => c.z));
const teeth = new Map<number, THREE.BufferGeometry>();
for (const upper of [true, false]) {
  for (const left of [false, true]) {
    const quadrant = upper ? (left ? 2 : 1) : left ? 3 : 4;
    const members = crowns
      .map((g, i) => ({ g, c: centres[i] }))
      .filter(({ c }) => c.y > planeY(c.z) === upper && c.x > 0 === left)
      .sort((a, b) => Math.atan2(Math.abs(a.c.x), a.c.z - backZ + 1) - Math.atan2(Math.abs(b.c.x), b.c.z - backZ + 1));
    if (members.length !== 8) throw new Error(`Quadrant ${quadrant}: expected 8 crowns, found ${members.length}`);
    members.forEach(({ g }, i) => teeth.set(quadrant * 10 + i + 1, g));
  }
}

// Gums, palate and tongue: one surface, split so the lower part (lower gum, floor of the
// mouth and tongue) can move with the mandible. Outside the arch the occlusal plane
// divides them. Inside it the top of the tongue rises a few mm above that plane, under the
// palate: there, upward-facing or low surfaces are tongue and the rest is palate.
const gumTris = { upper: [] as number[], lower: [] as number[] };
{
  // Inner edge of the lower arch: half-width at each depth, a little lingual of the crowns.
  const lowerTeeth = centres.filter((c) => c.y <= planeY(c.z));
  const ring = lowerTeeth.map((c) => ({ z: c.z, half: Math.abs(c.x) })).sort((a, b) => a.z - b.z);
  const frontZ = Math.max(...lowerTeeth.map((c) => c.z));
  const halfWidth = (z: number) => {
    if (z <= ring[0].z) return ring[0].half;
    for (let i = 1; i < ring.length; i++) {
      if (z <= ring[i].z) return ring[i - 1].half + ((ring[i].half - ring[i - 1].half) * (z - ring[i - 1].z)) / (ring[i].z - ring[i - 1].z);
    }
    return 0;
  };
  const MARGIN = 4; // mm lingual of the crown centres
  const TONGUE_TOP = 5; // mm above the occlusal plane: the tongue stays below, the palate above
  // Gum hugging a crown (papillae, the margin) belongs to that crown's jaw, whatever its height.
  const HUG = 2.5; // mm
  const BITE_ZONE = 6; // mm either side of the occlusal plane, where the jaws touch
  const crownPoints: { p: THREE.Vector3; upper: boolean }[] = [];
  crowns.forEach((g, i) => {
    const upper = centres[i].y > planeY(centres[i].z);
    const pos = g.attributes.position;
    for (let v = 0; v < pos.count; v++) crownPoints.push({ p: new THREE.Vector3().fromBufferAttribute(pos, v), upper });
  });
  const huggedJaw = (q: THREE.Vector3) => {
    let best = HUG * HUG;
    let jaw: boolean | null = null;
    for (const { p, upper } of crownPoints) {
      const d = p.distanceToSquared(q);
      if (d < best) {
        best = d;
        jaw = upper;
      }
    }
    return jaw;
  };

  const g = gumsSrc.geometry;
  const p = g.attributes.position;
  const idx = g.index!.array;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (let t = 0; t < idx.length / 3; t++) {
    a.fromBufferAttribute(p, idx[t * 3]);
    b.fromBufferAttribute(p, idx[t * 3 + 1]);
    c.fromBufferAttribute(p, idx[t * 3 + 2]);
    const m = a.clone().add(b).add(c).divideScalar(3);
    normal.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
    const above = m.y - planeY(m.z);
    const inside = m.z < frontZ - MARGIN && Math.abs(m.x) < halfWidth(m.z) - MARGIN;
    // With the mouth closed the tongue tip rests against the upper incisors and the lower
    // incisal edges touch the palate: a surface facing the other jaw belongs to that jaw.
    // (Only near the occlusal plane: by the roots, gum faces away from its own crowns.)
    const hugged = huggedJaw(m);
    const nearBite = Math.abs(above) < BITE_ZONE;
    const withinArch = Math.abs(m.x) < halfWidth(m.z) - MARGIN / 2 && m.z < frontZ + 1;
    const lower =
      hugged !== null
        ? hugged
          ? nearBite && normal.y > 0.3
          : !nearBite || normal.y > -0.3
        : inside
          ? normal.y > 0.2 || (normal.y > -0.2 && above < TONGUE_TOP) || above < 0
          : above < 0 || (withinArch && normal.y > 0.5);
    (lower ? gumTris.lower : gumTris.upper).push(t);
  }
}
const gumUpper = subset(gumsSrc.geometry, gumTris.upper);
const gumLower = subset(gumsSrc.geometry, gumTris.lower);
const everything = [...teeth.values(), gumUpper, gumLower];
const lowerSet = [...[...teeth].filter(([n]) => !isUpper(n)).map(([, g]) => g), gumLower];

// ---------------------------------------------------------------------------
// Level the occlusal plane, centre it, then open the mouth about the condyles.
// ---------------------------------------------------------------------------
{
  const tilt = Math.atan(slope);
  const level = new THREE.Matrix4()
    .makeTranslation(0, my, mz)
    .multiply(new THREE.Matrix4().makeRotationX(tilt))
    .multiply(new THREE.Matrix4().makeTranslation(0, -my, -mz));
  for (const g of everything) g.applyMatrix4(level);
  console.log(`occlusal plane levelled by ${((tilt * 180) / Math.PI).toFixed(1)}°`);
}
const bbox = (g: THREE.BufferGeometry) => {
  g.computeBoundingBox();
  return g.boundingBox!.clone();
};
{
  // Midline at x=0, occlusal plane at y=0, upper incisors' labial face at z≈3.5 (as the anatomical model).
  const b11 = bbox(teeth.get(11)!);
  const b21 = bbox(teeth.get(21)!);
  const occlusalY = mean([...teeth.values()].map((g) => centroid(g).y));
  const shift = new THREE.Matrix4().makeTranslation(
    -(b11.getCenter(new THREE.Vector3()).x + b21.getCenter(new THREE.Vector3()).x) / 2,
    -occlusalY,
    3.5 - Math.max(b11.max.z, b21.max.z)
  );
  for (const g of everything) g.applyMatrix4(shift);
}
function rotationAbout(point: THREE.Vector3, axis: THREE.Vector3, angle: number) {
  return new THREE.Matrix4()
    .makeTranslation(point.x, point.y, point.z)
    .multiply(new THREE.Matrix4().makeRotationAxis(axis, angle))
    .multiply(new THREE.Matrix4().makeTranslation(-point.x, -point.y, -point.z));
}
// No skull in this model: put the condyles where they sit in an average adult, ~22mm above
// the occlusal plane and ~15mm behind the last molars.
const lastMolarZ = Math.min(...[...teeth.values()].map((g) => bbox(g).min.z));
const pivot = new THREE.Vector3(0, 22, lastMolarZ - 15);
const hinge = new THREE.Vector3(1, 0, 0);
let opening = 0;
{
  const upperEdge = Math.min(bbox(teeth.get(11)!).min.y, bbox(teeth.get(21)!).min.y);
  let lo = 0;
  let hi = 0.6;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const m = rotationAbout(pivot, hinge, mid);
    const lowerEdge = Math.max(bbox(teeth.get(31)!.clone().applyMatrix4(m)).max.y, bbox(teeth.get(41)!.clone().applyMatrix4(m)).max.y);
    if (upperEdge - lowerEdge < TARGET_GAP) lo = mid;
    else hi = mid;
  }
  opening = (lo + hi) / 2;
  const open = rotationAbout(pivot, hinge, opening);
  for (const g of lowerSet) g.applyMatrix4(open);
  // Occlusal mid-plane back to y=0.
  const mid = (Math.min(bbox(teeth.get(11)!).min.y, bbox(teeth.get(21)!).min.y) + Math.max(bbox(teeth.get(31)!).max.y, bbox(teeth.get(41)!).max.y)) / 2;
  const shift = new THREE.Matrix4().makeTranslation(0, -mid, 0);
  for (const g of everything) g.applyMatrix4(shift);
  console.log(`jaw opened ${((opening * 180) / Math.PI).toFixed(1)}° → incisal gap ${TARGET_GAP}mm`);
}

// ---------------------------------------------------------------------------
// Tooth frames: origin at the CEJ, +Y occlusal, +Z buccal, +X = Y × Z.
// These are crowns only, so the jaw's occlusal direction is the long axis and the CEJ is
// one average crown height back from the crown tip.
// ---------------------------------------------------------------------------
const archCentre = new THREE.Vector3(0, 0, mean([...teeth.values()].map((g) => centroid(g).z)));
function toothFrame(n: number, geo: THREE.BufferGeometry) {
  const axis = isUpper(n) ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 1, 0).applyAxisAngle(hinge, opening);
  const c = centroid(geo);
  const p = geo.attributes.position;
  let tip = -Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) tip = Math.max(tip, v.fromBufferAttribute(p, i).sub(c).dot(axis));
  const origin = c.clone().addScaledVector(axis, tip - toothSpec(n).crownHeight);
  const outward = new THREE.Vector3(origin.x, 0, origin.z - archCentre.z).normalize();
  const z = outward.sub(axis.clone().multiplyScalar(outward.dot(axis))).normalize();
  const x = new THREE.Vector3().crossVectors(axis, z).normalize();
  const basis = new THREE.Matrix4().makeBasis(x, axis, z);
  return {
    matrix: basis.clone().setPosition(origin),
    position: origin,
    quaternion: new THREE.Quaternion().setFromRotationMatrix(basis),
  };
}

// ---------------------------------------------------------------------------
// Write the model: fresh document, metal/rough materials (three.js no longer reads the
// source's spec/gloss ones), textures re-encoded as JPEG, every mesh with white vertex
// colours (the chart's status materials multiply by them).
// ---------------------------------------------------------------------------
// Quiet: meshopt's quantizer reports every UV set that tiles outside [0, 1] (kept as floats).
const doc = new Document().setLogger(new Logger(Logger.Verbosity.ERROR));
const buffer = doc.createBuffer();
const scene = doc.createScene("dentalhub_realistic_mouth");
scene.setExtras({
  dentalhub: {
    description: "Lifelike mouth (game-style): textured crowns, gums and tongue; no roots, inner layers or jaw bone",
    credit: "Teeth & gums: “Human teeth” by Alexander Antipov, CC BY 4.0 (modified)",
    creditUrl: "https://sketchfab.com/3d-models/human-teeth-c4c569f0e08948e2a572007a7a5726f2",
  },
});

const sgOf = (m: ReturnType<typeof teethSrc.material.getExtension>) =>
  m as unknown as { getDiffuseTexture(): Texture | null };
const diffuseSrc = sgOf(teethSrc.material.getExtension("KHR_materials_pbrSpecularGlossiness")).getDiffuseTexture()!;
const normalSrc = teethSrc.material.getNormalTexture()!;
async function jpeg(texture: Texture, name: string, quality: number) {
  const data = await sharp(Buffer.from(texture.getImage()!)).jpeg({ quality, mozjpeg: true }).toBuffer();
  return doc.createTexture(name).setImage(new Uint8Array(data)).setMimeType("image/jpeg").setURI(`${name}.jpg`);
}
const diffuse = await jpeg(diffuseSrc, "mouth_color", 86);
const normal = await jpeg(normalSrc, "mouth_normal", 92);

const clearcoat = doc.createExtension(KHRMaterialsClearcoat);
function material(name: string, roughness: number, coat: number) {
  return doc
    .createMaterial(name)
    .setBaseColorTexture(diffuse)
    .setNormalTexture(normal)
    .setMetallicFactor(0)
    .setRoughnessFactor(roughness)
    .setDoubleSided(name === "gingiva")
    .setExtension("KHR_materials_clearcoat", clearcoat.createClearcoat().setClearcoatFactor(coat).setClearcoatRoughnessFactor(0.3));
}
const enamelMaterial = material("enamel", 0.34, 0.3);
const gumMaterial = material("gingiva", 0.42, 0.35);

function primitive(geo: THREE.BufferGeometry, mat: ReturnType<typeof material>) {
  const accessor = (array: Float32Array<ArrayBuffer> | Uint32Array<ArrayBuffer>, type: "VEC3" | "VEC2" | "SCALAR") =>
    doc.createAccessor().setArray(array).setType(type).setBuffer(buffer);
  const count = geo.attributes.position.count;
  return doc
    .createPrimitive()
    .setAttribute("POSITION", accessor(new Float32Array(geo.attributes.position.array), "VEC3"))
    .setAttribute("NORMAL", accessor(new Float32Array(geo.attributes.normal.array), "VEC3"))
    .setAttribute("TEXCOORD_0", accessor(new Float32Array(geo.attributes.uv.array), "VEC2"))
    .setAttribute("COLOR_0", accessor(new Float32Array(count * 3).fill(1), "VEC3"))
    .setIndices(accessor(new Uint32Array(geo.index!.array), "SCALAR"))
    .setMaterial(mat);
}

// With no roots or bone, how far the gum reaches beyond each CEJ bounds anything the chart
// draws there (an implant post): it goes in the tooth node's extras as `rootLength`.
const gumMesh = {
  upper: new THREE.Mesh(gumUpper, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })),
  lower: new THREE.Mesh(gumLower, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })),
};
const raycaster = new THREE.Raycaster();
// Sampled across an implant's width (~2.2mm radius): the gum is shallowest at its labial
// slope, so the thinnest reading wins, less a margin for the fixture's rounded tip.
function gumDepth(n: number, frame: ReturnType<typeof toothFrame>) {
  const rootward = new THREE.Vector3(0, -1, 0).applyQuaternion(frame.quaternion);
  const R = 2.2;
  let depth = Infinity;
  for (const [x, z] of [[0, 0], [R, 0], [-R, 0], [0, R], [0, -R]]) {
    const origin = new THREE.Vector3(x, 0, z).applyQuaternion(frame.quaternion).add(frame.position);
    raycaster.set(origin, rootward);
    const hit = raycaster.intersectObject(isUpper(n) ? gumMesh.upper : gumMesh.lower).find((h) => h.distance > 0.5);
    if (hit) depth = Math.min(depth, hit.distance);
  }
  const full = toothSpec(n).rootLength;
  if (!Number.isFinite(depth)) depth = full * 0.6;
  return Math.round(Math.min(full, Math.max(3, depth - 1.2)) * 10) / 10;
}

let triangles = 0;
const depths: string[] = [];
for (const [n, geo] of [...teeth].sort(([a], [b]) => a - b)) {
  const frame = toothFrame(n, geo);
  const local = geo.clone().applyMatrix4(frame.matrix.clone().invert());
  triangles += local.index!.count / 3;
  const rootLength = gumDepth(n, frame);
  depths.push(`${n}:${rootLength}`);
  const enamel = doc.createNode(`tooth_${n}_enamel`).setMesh(doc.createMesh(`tooth_${n}_enamel`).addPrimitive(primitive(local, enamelMaterial)));
  const node = doc
    .createNode(`tooth_${n}`)
    .setTranslation(frame.position.toArray() as [number, number, number])
    .setRotation(frame.quaternion.toArray() as [number, number, number, number])
    .setExtras({ rootLength })
    .addChild(enamel);
  scene.addChild(node);
}
console.log(`gum depth beyond the CEJ (mm): ${depths.join(" ")}`);
for (const [name, geo] of [["gingiva_upper", gumUpper], ["gingiva_lower", gumLower]] as const) {
  triangles += geo.index!.count / 3;
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive(geo, gumMaterial))));
}

await MeshoptEncoder.ready;
await doc.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
const out = await io.writeBinary(doc);
await writeFile(OUT, out);
console.log(`wrote ${OUT}: ${(out.byteLength / 1024 / 1024).toFixed(2)} MB, ${(triangles / 1000).toFixed(1)}k triangles`);
