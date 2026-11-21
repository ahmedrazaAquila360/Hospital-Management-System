// Builds public/models/dentition-bp3d.glb from BodyParts3D 3.0 meshes, following the
// 3D model contract in docs/dental-3d-model-spec.md.
//
// Source: BodyParts3D, Copyright© The Database Center for Life Science, licensed under
// CC Attribution-Share Alike 2.1 Japan. The output is a modified version of that data
// and is distributed under the same licence (see public/models/LICENSE-dentition.txt).
//
// Input: assets-src/bodyparts3d/<FMA id>.obj (git-ignored; fetched by range requests from
// the 3.0 OBJ archive — SOURCE.json records URL and checksums).
//
// Usage: pnpm exec tsx scripts/build-bodyparts3d-dentition.mts
import { readFile, writeFile } from "node:fs/promises";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune } from "@gltf-transform/functions";
import { buildCrownGeometry, buildRootGeometry, toothSpec } from "../src/components/dental-chart/three/tooth-geometry";

const SRC = "assets-src/bodyparts3d";
const OUT = "public/models/dentition-bp3d.glb";

// FMA id → FDI number. BodyParts3D has no third molars.
const TEETH: Record<string, number> = {
  FMA55681: 11, FMA55680: 12, FMA55798: 13, FMA55689: 14, FMA55688: 15, FMA55698: 16, FMA55697: 17,
  FMA55682: 21, FMA55683: 22, FMA55799: 23, FMA55690: 24, FMA55691: 25, FMA55699: 26, FMA55700: 27,
  FMA57143: 31, FMA57141: 32, FMA55687: 33, FMA55693: 34, FMA55692: 35, FMA55704: 36, FMA55703: 37,
  FMA57142: 41, FMA57140: 42, FMA55686: 43, FMA55694: 44, FMA55695: 45, FMA55705: 46, FMA55706: 47,
};
const PARTS = { mandible: "FMA52748", maxillaR: "FMA53649", maxillaL: "FMA53650", gumUpper: "FMA59763", gumLower: "FMA59764" };

// Inside of the arch, used to tell buccal from lingual when building tooth frames.
const ARCH_CENTRE_Z = -22;

// Triangle budgets — about 100k in total keeps phones and tablets smooth.
const BUDGET = { incisor: 1800, canine: 2000, premolar: 2200, molar: 3000, bone: 9000, maxilla: 5000, gum: 6000 };

// GLTFExporter reads its binary Blob through FileReader, which Node doesn't have.
class NodeFileReader {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then((b) => {
      this.result = b;
      this.onloadend?.();
    });
  }
}
(globalThis as unknown as { FileReader: unknown }).FileReader = NodeFileReader;

const isUpper = (n: number) => Math.floor(n / 10) <= 2;
const kindOf = (n: number) => toothSpec(n).kind;
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// BodyParts3D: x = patient's left, −y = anterior, z = superior (mm).
// Ours:        x = patient's left, +z = anterior, y = superior (mm).
const AXES = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1);

async function loadObj(id: string) {
  const group = new OBJLoader().parse(await readFile(`${SRC}/${id}.obj`, "utf8"));
  let mesh: THREE.Mesh | undefined;
  group.traverse((o) => {
    if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
  });
  const geo = mesh!.geometry.clone();
  geo.deleteAttribute("normal");
  geo.deleteAttribute("uv");
  geo.applyMatrix4(AXES);
  return mergeVertices(geo, 1e-4);
}

/** Welded, simplified to ~`targetTris` triangles, with smooth normals. Borders stay put. */
function simplify(geo: THREE.BufferGeometry, targetTris: number) {
  let g = mergeVertices(geo.index ? geo : geo, 1e-4);
  const index = new Uint32Array(g.index!.array);
  if (index.length / 3 > targetTris) {
    const positions = new Float32Array(g.attributes.position.array);
    const [out] = MeshoptSimplifier.simplify(index, positions, 3, targetTris * 3, 0.05, ["LockBorder"]);
    g.setIndex(new THREE.BufferAttribute(out, 1));
  }
  g = mergeVertices(g.toNonIndexed(), 1e-4); // drops vertices the simplifier no longer uses
  g.computeVertexNormals();
  return g;
}

function bbox(geo: THREE.BufferGeometry) {
  geo.computeBoundingBox();
  return geo.boundingBox!.clone();
}

/** Largest principal axis of a point cloud (power iteration on the covariance). */
function principalAxis(geo: THREE.BufferGeometry) {
  const p = geo.attributes.position;
  const c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) c.add(new THREE.Vector3().fromBufferAttribute(p, i));
  c.divideScalar(p.count);
  const m = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).sub(c);
    const a = [v.x, v.y, v.z];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) m[r * 3 + k] += a[r] * a[k];
  }
  let axis = new THREE.Vector3(0, 1, 0);
  for (let it = 0; it < 50; it++) {
    axis = new THREE.Vector3(
      m[0] * axis.x + m[1] * axis.y + m[2] * axis.z,
      m[3] * axis.x + m[4] * axis.y + m[5] * axis.z,
      m[6] * axis.x + m[7] * axis.y + m[8] * axis.z
    ).normalize();
  }
  return { centroid: c, axis };
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------
await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

const teeth = new Map<number, THREE.BufferGeometry>();
for (const [id, n] of Object.entries(TEETH)) teeth.set(n, await loadObj(id));
const mandible = await loadObj(PARTS.mandible);
const maxilla = mergeVertices(mergeGeometries([await loadObj(PARTS.maxillaR), await loadObj(PARTS.maxillaL)])!, 1e-4);
const gumUpper = await loadObj(PARTS.gumUpper);
const gumLower = await loadObj(PARTS.gumLower);
const lowerSet = [mandible, gumLower, ...[...teeth].filter(([n]) => !isUpper(n)).map(([, g]) => g)];
const everything = [...teeth.values(), mandible, maxilla, gumUpper, gumLower];

// ---------------------------------------------------------------------------
// Level the occlusal plane: the CT's head pose tilts it ~10°, which skews every
// camera preset. Rotate about the left–right axis so the upper incisal tip and the
// first-molar cusps sit at the same height.
// ---------------------------------------------------------------------------
function lowestPoint(geo: THREE.BufferGeometry) {
  const p = geo.attributes.position;
  let best = new THREE.Vector3(0, Infinity, 0);
  for (let i = 0; i < p.count; i++) if (p.getY(i) < best.y) best = new THREE.Vector3().fromBufferAttribute(p, i);
  return best;
}
{
  const incisal = lowestPoint(teeth.get(11)!).add(lowestPoint(teeth.get(21)!)).multiplyScalar(0.5);
  const molar = lowestPoint(teeth.get(16)!).add(lowestPoint(teeth.get(26)!)).multiplyScalar(0.5);
  const tilt = Math.atan2(molar.y - incisal.y, incisal.z - molar.z);
  const level = rotationAbout(incisal, new THREE.Vector3(1, 0, 0), tilt);
  for (const g of everything) g.applyMatrix4(level);
  console.log(`occlusal plane levelled by ${((tilt * 180) / Math.PI).toFixed(1)}°`);
}

// ---------------------------------------------------------------------------
// Open the mouth: rotate the mandible and everything on it about the condyles
// until the incisal edges are ~12mm apart (the chart's inspection view).
// ---------------------------------------------------------------------------
function condyle(side: 1 | -1) {
  const p = mandible.attributes.position;
  let best = new THREE.Vector3(0, -Infinity, 0);
  for (let i = 0; i < p.count; i++) {
    if (p.getX(i) * side > 20 && p.getY(i) > best.y) best = new THREE.Vector3().fromBufferAttribute(p, i);
  }
  return best;
}
const condL = condyle(1);
const condR = condyle(-1);
const pivot = condL.clone().add(condR).multiplyScalar(0.5);
const hinge = condL.clone().sub(condR).normalize();
const incisalGap = () => bbox(teeth.get(11)!).min.y - bbox(teeth.get(41)!).max.y;
const TARGET_GAP = 20;
let lo = 0;
let hi = 0.6;
const lowerTooth = teeth.get(41)!.clone();
for (let i = 0; i < 40; i++) {
  const mid = (lo + hi) / 2;
  const test = lowerTooth.clone().applyMatrix4(rotationAbout(pivot, hinge, mid));
  const gap = bbox(teeth.get(11)!).min.y - bbox(test).max.y;
  if (gap < TARGET_GAP) lo = mid;
  else hi = mid;
}
const opening = (lo + hi) / 2;
const open = rotationAbout(pivot, hinge, opening);
for (const g of lowerSet) g.applyMatrix4(open);
console.log(`jaw opened ${((opening * 180) / Math.PI).toFixed(1)}° → incisal gap ${incisalGap().toFixed(1)}mm`);

function rotationAbout(point: THREE.Vector3, axis: THREE.Vector3, angle: number) {
  return new THREE.Matrix4()
    .makeTranslation(point.x, point.y, point.z)
    .multiply(new THREE.Matrix4().makeRotationAxis(axis, angle))
    .multiply(new THREE.Matrix4().makeTranslation(-point.x, -point.y, -point.z));
}

// ---------------------------------------------------------------------------
// Recentre: midline at x=0, occlusal mid-plane at y=0, upper incisor labial face near z≈3.5
// ---------------------------------------------------------------------------
{
  const b11 = bbox(teeth.get(11)!);
  const b21 = bbox(teeth.get(21)!);
  const b41 = bbox(teeth.get(41)!);
  const shift = new THREE.Vector3(
    -(b11.getCenter(new THREE.Vector3()).x + b21.getCenter(new THREE.Vector3()).x) / 2,
    -(b11.min.y + b41.max.y) / 2,
    3.5 - Math.max(b11.max.z, b21.max.z)
  );
  const t = new THREE.Matrix4().makeTranslation(shift.x, shift.y, shift.z);
  for (const g of everything) g.applyMatrix4(t);
}

// Keep the alveolar part of the maxilla: crop a few mm above the highest root apex.
function cropAbove(geo: THREE.BufferGeometry, maxY: number) {
  const p = geo.attributes.position;
  const idx = geo.index!.array;
  const kept: number[] = [];
  for (let i = 0; i < idx.length; i += 3) {
    if (p.getY(idx[i]) < maxY && p.getY(idx[i + 1]) < maxY && p.getY(idx[i + 2]) < maxY) kept.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  geo.setIndex(kept);
  return geo;
}
const upperApex = Math.max(...[...teeth].filter(([n]) => isUpper(n)).map(([, g]) => bbox(g).max.y));
cropAbove(maxilla, upperApex + 5);

// Soft tissue over the alveolar ridges. BodyParts3D's gingiva is only a collar at the
// tooth necks, so on its own it leaves the roots bare. Like a dental typodont, the gum
// layer also covers the alveolar bone: the ridge part of each jaw, thickened slightly.
function alveolarRidge(bone: THREE.BufferGeometry, keep: (p: THREE.Vector3) => boolean, thickness: number) {
  const g = bone.clone();
  const p = g.attributes.position;
  const idx = g.index!.array;
  const v = new THREE.Vector3();
  const kept: number[] = [];
  for (let i = 0; i < idx.length; i += 3) {
    if ([0, 1, 2].every((k) => keep(v.fromBufferAttribute(p, idx[i + k])))) kept.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  g.setIndex(kept);
  g.computeVertexNormals();
  const n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) + n.getX(i) * thickness, p.getY(i) + n.getY(i) * thickness, p.getZ(i) + n.getZ(i) * thickness);
  }
  g.deleteAttribute("normal");
  return g;
}
const jawBoxes = (upper: boolean) => [...teeth].filter(([n]) => isUpper(n) === upper).map(([, g]) => bbox(g));
// Only tissue over the dental arch: within ~9mm (in plan view) of a tooth.
const nearArch = (boxes: THREE.Box3[]) => (q: THREE.Vector3) =>
  boxes.some((b) => {
    const c = b.getCenter(new THREE.Vector3());
    return Math.hypot(q.x - c.x, q.z - c.z) < 9;
  });
const upperBoxes = jawBoxes(true);
const lowerBoxes = jawBoxes(false);
const lowerApex = Math.min(...lowerBoxes.map((b) => b.min.y));
const nearUpper = nearArch(upperBoxes);
const nearLower = nearArch(lowerBoxes);
const ridgeUpper = alveolarRidge(maxilla, (q) => nearUpper(q), 0.6);
const ridgeLower = alveolarRidge(mandible, (q) => q.y > lowerApex - 4 && nearLower(q), 0.6);
const softUpper = mergeVertices(mergeGeometries([gumUpper, ridgeUpper])!, 1e-4);
const softLower = mergeVertices(mergeGeometries([gumLower, ridgeLower])!, 1e-4);

// The segmented gingiva overlaps the crowns by a few mm (most at the molars). Pull the
// margin back to just past each tooth's cemento-enamel junction, as in a healthy mouth.
function clampMargin(geo: THREE.BufferGeometry, upper: boolean) {
  const ceJ = [...teeth]
    .filter(([n]) => isUpper(n) === upper)
    .map(([n, g]) => toothFrame(n, g).position);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    let nearest = ceJ[0];
    let best = Infinity;
    for (const c of ceJ) {
      const d = Math.hypot(x - c.x, z - c.z);
      if (d < best) {
        best = d;
        nearest = c;
      }
    }
    if (best > 9) continue;
    const limit = nearest.y + (upper ? 0.6 : -0.6);
    if (upper ? p.getY(i) < limit : p.getY(i) > limit) p.setY(i, limit);
  }
}
clampMargin(softUpper, true);
clampMargin(softLower, false);

// ---------------------------------------------------------------------------
// Tooth frames: origin at the CEJ, +Y occlusal, +Z buccal, +X = Y × Z
// ---------------------------------------------------------------------------
type Frame = { matrix: THREE.Matrix4; position: THREE.Vector3; quaternion: THREE.Quaternion };

function toothFrame(n: number, geo: THREE.BufferGeometry): Frame {
  const { centroid, axis } = principalAxis(geo);
  const occlusal = new THREE.Vector3(0, isUpper(n) ? -1 : 1, 0);
  if (axis.dot(occlusal) < 0) axis.negate();
  // Crown tip along the axis, then step back by the tooth type's crown height to the CEJ.
  const p = geo.attributes.position;
  let tip = -Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) tip = Math.max(tip, v.fromBufferAttribute(p, i).sub(centroid).dot(axis));
  const origin = centroid.clone().addScaledVector(axis, tip - toothSpec(n).crownHeight);
  const outward = new THREE.Vector3(origin.x, 0, origin.z - ARCH_CENTRE_Z).normalize();
  const z = outward.sub(axis.clone().multiplyScalar(outward.dot(axis))).normalize();
  const x = new THREE.Vector3().crossVectors(axis, z).normalize();
  const matrix = new THREE.Matrix4().makeBasis(x, axis, z).setPosition(origin);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, axis, z));
  return { matrix, position: origin, quaternion };
}

// Natural shade baked into vertex colours (no textures to download).
const C = (hex: string) => new THREE.Color(hex);
const ENAMEL = { body: C("#f5f1e8"), warm: C("#ede3cf"), cervical: C("#e0cfae"), incisal: C("#d8dde0") };
const CEMENTUM = { neck: C("#ead9b8"), apex: C("#d2b88a") };
const GINGIVA = { margin: C("#e3a59c"), attached: C("#d69089"), mucosa: C("#c4716e") };
const BONE = { top: C("#efe6d2"), deep: C("#ddd0b4") };

function colourTooth(n: number, geo: THREE.BufferGeometry) {
  const box = bbox(geo);
  const crown = Math.max(box.max.y, 1);
  const root = Math.max(-box.min.y, 1);
  const anterior = kindOf(n) === "incisor" || kindOf(n) === "canine";
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y >= 0) {
      const t = y / crown;
      c.copy(ENAMEL.body).lerp(ENAMEL.warm, kindOf(n) === "canine" ? 0.4 : 0.15);
      c.lerp(ENAMEL.cervical, smoothstep(0.38, 0.02, t) * 0.75);
      if (anterior) c.lerp(ENAMEL.incisal, smoothstep(0.78, 1, t) * 0.55);
      const occlusion = 1 - 0.12 * smoothstep(0.12, 0, t);
      c.multiplyScalar(occlusion);
    } else {
      c.copy(CEMENTUM.neck).lerp(CEMENTUM.apex, Math.min(1, -y / root));
    }
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

function colourByHeight(geo: THREE.BufferGeometry, upper: boolean, from: THREE.Color, mid: THREE.Color, to: THREE.Color) {
  const box = bbox(geo);
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    // 0 at the edge nearest the teeth, 1 farthest away.
    const t = upper ? (p.getY(i) - box.min.y) / (box.max.y - box.min.y) : (box.max.y - p.getY(i)) / (box.max.y - box.min.y);
    c.copy(from).lerp(mid, smoothstep(0, 0.35, t)).lerp(to, smoothstep(0.5, 1, t));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

// ---------------------------------------------------------------------------
// Assemble the scene
// ---------------------------------------------------------------------------
function splitAtCej(geo: THREE.BufferGeometry) {
  const p = geo.attributes.position;
  const idx = geo.index!.array;
  const crown: number[] = [];
  const root: number[] = [];
  for (let i = 0; i < idx.length; i += 3) {
    const y = (p.getY(idx[i]) + p.getY(idx[i + 1]) + p.getY(idx[i + 2])) / 3;
    (y >= 0 ? crown : root).push(idx[i], idx[i + 1], idx[i + 2]);
  }
  const part = (tris: number[]) => {
    const g = geo.clone();
    g.setIndex(tris);
    return mergeVertices(g.toNonIndexed(), 1e-5); // drop vertices the other part uses
  };
  return [part(crown), part(root)] as const;
}

const materials = {
  root: new THREE.MeshStandardMaterial({ name: "root", color: "#ffffff", vertexColors: true, roughness: 0.62 }),
  enamel: new THREE.MeshPhysicalMaterial({ name: "enamel", color: "#ffffff", vertexColors: true, roughness: 0.36, clearcoat: 0.3, clearcoatRoughness: 0.32 }),
  gingiva: new THREE.MeshPhysicalMaterial({ name: "gingiva", color: "#ffffff", vertexColors: true, roughness: 0.5, clearcoat: 0.18, clearcoatRoughness: 0.45 }),
  bone: new THREE.MeshStandardMaterial({ name: "bone", color: "#ffffff", vertexColors: true, roughness: 0.82 }),
};

const scene = new THREE.Scene();
scene.name = "dentalhub_dentition";
scene.userData = {
  dentalhub: {
    description: "BodyParts3D anatomy (CT-derived, one adult); third molars are schematic",
    credit: "Anatomy: BodyParts3D © DBCLS, CC BY-SA 2.1 JP (modified)",
    creditUrl: "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/",
  },
};

const frames = new Map<number, Frame>();
let triangles = 0;
for (const [n, raw] of teeth) {
  const frame = toothFrame(n, raw);
  frames.set(n, frame);
  const local = simplify(raw, BUDGET[kindOf(n)]).applyMatrix4(frame.matrix.clone().invert());
  colourTooth(n, local);
  triangles += local.index!.count / 3;
  const node = new THREE.Object3D();
  node.name = `tooth_${n}`;
  node.position.copy(frame.position);
  node.quaternion.copy(frame.quaternion);
  // Split at the CEJ (local y = 0): crown → enamel layer, root → dentin & roots layer, so
  // restorations stay on the crown and implants can hide the natural root.
  const [crownGeo, rootGeo] = splitAtCej(local);
  const enamel = new THREE.Mesh(crownGeo, materials.enamel);
  enamel.name = `tooth_${n}_enamel`;
  const root = new THREE.Mesh(rootGeo, materials.root);
  root.name = `tooth_${n}_dentin`;
  node.add(enamel, root);
  scene.add(node);
}

// Third molars: BodyParts3D has none, so place schematic ones distal to the second molars.
for (const [third, second] of [[18, 17], [28, 27], [38, 37], [48, 47]] as const) {
  const f = frames.get(second)!;
  const spec2 = toothSpec(second);
  const spec3 = toothSpec(third);
  const q = Math.floor(third / 10);
  const distalSign = (q === 2 || q === 3 ? 1 : -1) * (isUpper(third) ? -1 : 1);
  const offset = new THREE.Vector3(distalSign * (spec2.width / 2 + spec3.width / 2 + 0.3), 0, 0).applyQuaternion(f.quaternion);
  const geo = simplify(
    mergeGeometries([buildCrownGeometry(spec3, distalSign, !isUpper(third)), buildRootGeometry(spec3, distalSign)])!,
    BUDGET.molar
  );
  triangles += geo.index!.count / 3;
  const node = new THREE.Object3D();
  node.name = `tooth_${third}`;
  node.userData = { schematic: true };
  node.position.copy(f.position).add(offset);
  node.quaternion.copy(f.quaternion);
  const [crownGeo, rootGeo] = splitAtCej(geo);
  const enamel = new THREE.Mesh(crownGeo, materials.enamel);
  enamel.name = `tooth_${third}_enamel`;
  const root = new THREE.Mesh(rootGeo, materials.root);
  root.name = `tooth_${third}_dentin`;
  node.add(enamel, root);
  scene.add(node);
}

const parts: [string, THREE.BufferGeometry, number, THREE.Material, (g: THREE.BufferGeometry) => void][] = [
  ["gingiva_upper", softUpper, BUDGET.gum * 2, materials.gingiva, (g) => colourByHeight(g, true, GINGIVA.margin, GINGIVA.attached, GINGIVA.mucosa)],
  ["gingiva_lower", softLower, BUDGET.gum * 2, materials.gingiva, (g) => colourByHeight(g, false, GINGIVA.margin, GINGIVA.attached, GINGIVA.mucosa)],
  ["maxilla", maxilla, BUDGET.maxilla * 2, materials.bone, (g) => colourByHeight(g, true, BONE.top, BONE.top, BONE.deep)],
  ["mandible", mandible, BUDGET.bone, materials.bone, (g) => colourByHeight(g, false, BONE.top, BONE.top, BONE.deep)],
];
for (const [name, raw, budget, material, colour] of parts) {
  const geo = simplify(raw, budget);
  colour(geo);
  triangles += geo.index!.count / 3;
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = name;
  scene.add(mesh);
}

// ---------------------------------------------------------------------------
// Export, then quantize + Meshopt-compress
// ---------------------------------------------------------------------------
const glb = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const doc = await io.readBinary(new Uint8Array(glb));
await doc.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
const out = await io.writeBinary(doc);
await writeFile(OUT, out);
console.log(`wrote ${OUT}: ${(out.byteLength / 1024 / 1024).toFixed(2)} MB, ${Math.round(triangles / 1000)}k triangles`);
