import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LOWER_LEFT, LOWER_RIGHT, UPPER_LEFT, UPPER_RIGHT, type ToothSurface } from "@/lib/dental";

/*
 * Procedural, anatomically-proportioned permanent dentition.
 *
 * Units are millimetres. Every tooth is built in its own local space:
 *   +y  → occlusal / incisal (crown up; the upper jaw is flipped at placement time)
 *   +z  → buccal / labial (towards the cheek or lips)
 *   ±x  → mesiodistal; `distalSign` says which way is distal in geometry space
 *   y=0 → cemento-enamel junction (CEJ); roots extend into -y.
 */

type ToothKind = "incisor" | "canine" | "premolar" | "molar";
type RootLayout = "single" | "bl-pair" | "md-pair" | "tri";

export type ToothSpec = {
  kind: ToothKind;
  /** Mesiodistal crown width. */
  width: number;
  /** Buccolingual crown depth. */
  depth: number;
  crownHeight: number;
  rootLength: number;
  roots: RootLayout;
};

// Average crown/root dimensions (mm) by position 1–8 within a quadrant.
const UPPER_SPECS: ToothSpec[] = [
  { kind: "incisor", width: 8.6, depth: 7.0, crownHeight: 10.5, rootLength: 13, roots: "single" },
  { kind: "incisor", width: 6.6, depth: 6.0, crownHeight: 9.0, rootLength: 13, roots: "single" },
  { kind: "canine", width: 7.6, depth: 8.0, crownHeight: 10.0, rootLength: 17, roots: "single" },
  { kind: "premolar", width: 7.0, depth: 9.0, crownHeight: 8.5, rootLength: 14, roots: "bl-pair" },
  { kind: "premolar", width: 6.6, depth: 9.0, crownHeight: 8.0, rootLength: 14, roots: "single" },
  { kind: "molar", width: 10.2, depth: 11.0, crownHeight: 7.5, rootLength: 12.5, roots: "tri" },
  { kind: "molar", width: 9.2, depth: 11.0, crownHeight: 7.0, rootLength: 11.5, roots: "tri" },
  { kind: "molar", width: 8.6, depth: 10.0, crownHeight: 6.5, rootLength: 11, roots: "tri" },
];

const LOWER_SPECS: ToothSpec[] = [
  { kind: "incisor", width: 5.2, depth: 6.0, crownHeight: 9.0, rootLength: 12.5, roots: "single" },
  { kind: "incisor", width: 5.8, depth: 6.4, crownHeight: 9.5, rootLength: 14, roots: "single" },
  { kind: "canine", width: 7.0, depth: 7.6, crownHeight: 11.0, rootLength: 16, roots: "single" },
  { kind: "premolar", width: 7.0, depth: 7.6, crownHeight: 8.5, rootLength: 14, roots: "single" },
  { kind: "premolar", width: 7.1, depth: 8.2, crownHeight: 8.0, rootLength: 14.5, roots: "single" },
  { kind: "molar", width: 11.2, depth: 10.4, crownHeight: 7.5, rootLength: 14, roots: "md-pair" },
  { kind: "molar", width: 10.5, depth: 10.0, crownHeight: 7.0, rootLength: 13, roots: "md-pair" },
  { kind: "molar", width: 10.0, depth: 9.6, crownHeight: 7.0, rootLength: 11, roots: "md-pair" },
];

export function isUpper(toothNumber: number) {
  const q = Math.floor(toothNumber / 10);
  return q === 1 || q === 2;
}

export function toothSpec(toothNumber: number): ToothSpec {
  const idx = (toothNumber % 10) - 1;
  return (isUpper(toothNumber) ? UPPER_SPECS : LOWER_SPECS)[idx];
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Crown silhouette at normalised height y (0 = CEJ, 1 = occlusal):
 * `r` is the overall bulge (cervical constriction → height of contour),
 * `tx`/`tz` taper width/depth towards the incisal edge or cusp tip.
 */
function crownProfile(kind: ToothKind, y: number) {
  const cervical = lerp(0.72, 1, smoothstep(0, 0.4, y));
  const r = cervical * (0.92 + 0.08 * Math.sin(Math.PI * y));
  switch (kind) {
    case "incisor":
      return { r, tx: lerp(0.78, 1, smoothstep(0, 0.65, y)), tz: lerp(1, 0.3, smoothstep(0.3, 1, y)) };
    case "canine":
      return { r, tx: lerp(1, 0.5, smoothstep(0.55, 1, y)), tz: lerp(1, 0.55, smoothstep(0.4, 1, y)) };
    default:
      return { r, tx: 1, tz: 1 };
  }
}

/** Half-extents of the crown at normalised height y — used to seat surface details. */
export function crownExtent(spec: ToothSpec, y: number) {
  const { r, tx, tz } = crownProfile(spec.kind, y);
  return { hx: (spec.width / 2) * r * tx, hz: (spec.depth / 2) * r * tz };
}

const gauss = (u: number, v: number, cu: number, cv: number, s: number) =>
  Math.exp(-((u - cu) ** 2 + (v - cv) ** 2) / s);

/** A narrow trough along a line — fissures and developmental grooves. */
const groove = (d: number, width: number) => Math.exp(-(d * d) / width);

function occlusalRelief(spec: ToothSpec, u: number, v: number, distalSign: number, lower: boolean) {
  const h = spec.crownHeight;
  switch (spec.kind) {
    case "molar": {
      let field =
        gauss(u, v, -0.45, 0.45, 0.14) +
        gauss(u, v, 0.45, 0.45, 0.14) +
        gauss(u, v, -0.45, -0.45, 0.14) * 1.05 +
        gauss(u, v, 0.45, -0.45, 0.14) * 0.9;
      if (lower) field += gauss(u, v, distalSign * 0.78, 0.15, 0.08) * 0.8; // distal cusp
      field -= gauss(u, v, 0, 0, 0.1) * 0.6; // central fossa
      // Marginal ridges close the occlusal table mesially and distally.
      field += Math.exp(-((Math.abs(u) - 0.86) ** 2) / 0.012) * 0.35;
      // Central (mesiodistal) groove and the buccal/lingual grooves between cusps.
      const fissure = groove(v, 0.006) * (1 - u * u) * 0.45 + groove(u, 0.006) * 0.3;
      return (field - 0.55 - fissure) * h * 0.13;
    }
    case "premolar": {
      const lingual = lower ? 0.55 : 0.85;
      let field = gauss(u, v, 0, 0.5, 0.2) + gauss(u, v, 0, -0.5, 0.2) * lingual - gauss(u, v, 0, 0, 0.06) * 0.5;
      field += Math.exp(-((Math.abs(u) - 0.84) ** 2) / 0.014) * 0.25;
      field -= groove(v, 0.008) * (1 - u * u) * 0.4;
      return (field - 0.6) * h * 0.14;
    }
    case "canine":
      return (1 - Math.min(1, Math.hypot(u, v * 0.8))) * h * 0.2;
    case "incisor":
      // Gentle incisal curve plus three faint mamelons along the edge.
      return (-0.06 * u * u + 0.012 * Math.cos(u * Math.PI * 1.5)) * h;
  }
}

// Enamel shades (sRGB). Vertex colours carry the natural gradient and baked occlusion,
// so the enamel material itself stays a neutral white.
const ENAMEL = {
  body: new THREE.Color("#f5f1e8"),
  warm: new THREE.Color("#ede3cf"),
  cervical: new THREE.Color("#e0cfae"),
  incisal: new THREE.Color("#d8dde0"),
  fissure: new THREE.Color("#a68c66"),
};

/** Small, stable per-tooth shade variation so the arch doesn't look cloned. */
function toothShadeJitter(spec: ToothSpec, distalSign: number) {
  const seed = spec.width * 13.7 + spec.depth * 7.1 + distalSign * 3.3;
  return (Math.sin(seed) * 0.5 + 0.5) * 0.25;
}

export function buildCrownGeometry(spec: ToothSpec, distalSign: number, lower: boolean) {
  let geo: THREE.BufferGeometry = new THREE.SphereGeometry(1, 64, 48);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  const p = spec.kind === "molar" ? 0.55 : spec.kind === "premolar" ? 0.65 : 0.8;
  const q = 0.4;
  const anterior = spec.kind === "incisor" || spec.kind === "canine";
  // Canines are naturally a shade more saturated than incisors.
  const warmth = toothShadeJitter(spec, distalSign) + (spec.kind === "canine" ? 0.3 : 0);
  const flat = spec.kind === "molar" || spec.kind === "premolar" ? 0 : 1;

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const sx = Math.sign(v.x) * Math.abs(v.x) ** p;
    const sz = Math.sign(v.z) * Math.abs(v.z) ** p;
    const y = 0.5 + 0.5 * Math.sign(v.y) * Math.abs(v.y) ** q;
    const { r, tx, tz } = crownProfile(spec.kind, y);
    const x = sx * (spec.width / 2) * r * tx;
    let z = sz * (spec.depth / 2) * r * tz;
    const top = smoothstep(0.62, 0.98, y);
    const relief = top * occlusalRelief(spec, sx, sz, distalSign, lower);
    // Incisors: slight labial curvature of the crown towards the incisal edge.
    const labial = spec.kind === "incisor" ? 0.35 * y * y : 0;
    // Anterior teeth: shallow lingual fossa above a rounded cingulum near the neck.
    if (anterior && sz < 0) {
      const fossa = Math.exp(-((y - 0.62) ** 2) / 0.04) * (1 - sx * sx) * 0.55;
      const cingulum = Math.exp(-((y - 0.25) ** 2) / 0.012) * (1 - sx * sx) * 0.35;
      z += (fossa - cingulum) * Math.abs(sz);
    }
    pos.setXYZ(i, x, y * spec.crownHeight + relief, z + labial);

    // --- colour: body → warmer neck → translucent incisal edge, plus baked occlusion.
    c.copy(ENAMEL.body).lerp(ENAMEL.warm, Math.min(1, warmth));
    c.lerp(ENAMEL.cervical, smoothstep(0.38, 0.02, y) * 0.75);
    if (anterior) c.lerp(ENAMEL.incisal, smoothstep(0.74, 1, y) * 0.55 * flat + smoothstep(0.82, 1, y) * 0.15);
    const fissure = Math.min(1, Math.max(0, -relief) / (spec.crownHeight * 0.06));
    c.lerp(ENAMEL.fissure, fissure * top * 0.55);
    // Interproximal contacts and the gingival third sit in shadow.
    const occlusion = 1 - 0.14 * Math.abs(sx) ** 6 - 0.12 * smoothstep(0.12, 0, y);
    colors.set([c.r * occlusion, c.g * occlusion, c.b * occlusion], i * 3);
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.deleteAttribute("normal");
  geo.deleteAttribute("uv");
  geo = mergeVertices(geo);
  geo.computeVertexNormals();
  return geo;
}

type RootDef = { ox: number; oz: number; rx: number; rz: number; length: number };

function rootDefs(spec: ToothSpec, distalSign: number): RootDef[] {
  const { width: w, depth: d, rootLength: L } = spec;
  const mesial = -distalSign;
  switch (spec.roots) {
    case "single":
      return [{ ox: 0, oz: 0, rx: w * 0.32, rz: d * 0.34, length: L }];
    case "bl-pair":
      return [
        { ox: 0, oz: d * 0.2, rx: w * 0.26, rz: d * 0.17, length: L },
        { ox: 0, oz: -d * 0.2, rx: w * 0.26, rz: d * 0.17, length: L * 0.95 },
      ];
    case "md-pair":
      return [
        { ox: mesial * w * 0.24, oz: 0, rx: w * 0.19, rz: d * 0.33, length: L },
        { ox: -mesial * w * 0.24, oz: 0, rx: w * 0.18, rz: d * 0.31, length: L * 0.92 },
      ];
    case "tri":
      return [
        { ox: mesial * w * 0.22, oz: d * 0.2, rx: w * 0.17, rz: d * 0.16, length: L * 0.92 },
        { ox: -mesial * w * 0.22, oz: d * 0.2, rx: w * 0.15, rz: d * 0.15, length: L * 0.86 },
        { ox: 0, oz: -d * 0.24, rx: w * 0.19, rz: d * 0.19, length: L },
      ];
  }
}

/** Splays the apex away from the tooth's long axis, as real multi-rooted teeth do. */
function placeRoot(geo: THREE.BufferGeometry, def: RootDef) {
  if (def.ox !== 0) geo.rotateZ(0.12 * Math.sign(def.ox));
  if (def.oz !== 0) geo.rotateX(-0.12 * Math.sign(def.oz));
  geo.translate(def.ox, 0, def.oz);
  return geo;
}

function rootLathe(length: number, rx: number, rz: number) {
  const pts: THREE.Vector2[] = [];
  const steps = 14;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const radius = (1 - 0.68 * t ** 1.5) * Math.sqrt(Math.max(0, 1 - t ** 6));
    pts.push(new THREE.Vector2(Math.max(radius, 0.0001), 1.5 - t * (length + 1.5)));
  }
  const geo = new THREE.LatheGeometry(pts, 24);
  geo.scale(rx, 1, rz);
  return geo;
}

function finalize(parts: THREE.BufferGeometry[]) {
  const cleaned = parts.map((g) => {
    const c = g.index ? g.toNonIndexed() : g;
    c.deleteAttribute("uv");
    c.deleteAttribute("normal");
    return c;
  });
  let merged = mergeGeometries(cleaned)!;
  merged = mergeVertices(merged);
  merged.computeVertexNormals();
  return merged;
}

const CEMENTUM = { neck: new THREE.Color("#ead9b8"), apex: new THREE.Color("#d2b88a") };

export function buildRootGeometry(spec: ToothSpec, distalSign: number) {
  const geo = finalize(rootDefs(spec, distalSign).map((def) => placeRoot(rootLathe(def.length, def.rx, def.rz), def)));
  // Cementum darkens slightly towards the apex.
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.copy(CEMENTUM.neck).lerp(CEMENTUM.apex, clamp01(-pos.getY(i) / spec.rootLength));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

/**
 * Coronal dentin: the crown shrunk inside its enamel (≈1–2mm enamel at the sides,
 * thicker over the cusps), coloured as dentin. Hidden behind enamel unless enamel
 * is turned off or the tooth is sectioned.
 */
export function buildDentinCrownGeometry(spec: ToothSpec, distalSign: number, lower: boolean) {
  const geo = buildCrownGeometry(spec, distalSign, lower);
  geo.scale(0.8, 0.84, 0.78);
  const colors = geo.attributes.color as THREE.BufferAttribute;
  const c = new THREE.Color();
  for (let i = 0; i < colors.count; i++) {
    c.copy(DENTIN).lerp(CEMENTUM.neck, smoothstep(0.3, 0, geo.attributes.position.getY(i) / spec.crownHeight) * 0.5);
    colors.setXYZ(i, c.r, c.g, c.b);
  }
  return geo;
}

const DENTIN = new THREE.Color("#e8d09c");

/** Pulp chamber and root canals — the pulp layer; drawn as gutta-percha for root-canal-treated teeth. */
export function buildCanalGeometry(spec: ToothSpec, distalSign: number) {
  const anterior = spec.kind === "incisor" || spec.kind === "canine";
  // Chamber: a tall, narrow horn under the incisal edge for anterior teeth; a wider,
  // flatter roof under the cusps for premolars and molars.
  const chamberY = spec.crownHeight * (anterior ? 0.3 : 0.24);
  const chamber = new THREE.SphereGeometry(1, 20, 16);
  if (anterior) chamber.scale(spec.width * 0.17, spec.crownHeight * 0.34, spec.depth * 0.15);
  else chamber.scale(spec.width * (spec.kind === "molar" ? 0.3 : 0.22), spec.crownHeight * 0.17, spec.depth * 0.26);
  chamber.translate(0, chamberY, 0);

  // Canals run from the chamber floor to just short of each apex, narrowing as they go.
  const parts = rootDefs(spec, distalSign).map((def) => {
    const len = def.length * 0.92 + chamberY;
    const canal = new THREE.CylinderGeometry(anterior ? 0.7 : 0.55, 0.16, len, 12, 1);
    canal.translate(0, chamberY - len / 2, 0);
    return placeRoot(canal, def);
  });
  parts.push(chamber);
  return finalize(parts);
}

/** Threaded titanium fixture with abutment, replacing the natural root. */
export function buildImplantGeometry(spec: ToothSpec) {
  const length = Math.min(spec.rootLength * 0.85, 13);
  const radius = Math.min(spec.width, spec.depth) * 0.22 + 0.4;
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.0001, 0)];
  const steps = 64;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const thread = ((t * length) / 0.9) % 1 < 0.5 ? 0.28 : 0;
    const taper = 1 - 0.3 * t ** 2;
    pts.push(new THREE.Vector2(radius * taper + thread * (1 - t * 0.5), -t * length));
  }
  pts.push(new THREE.Vector2(0.0001, -length - 0.4));
  const fixture = new THREE.LatheGeometry(pts, 28);
  const abutment = new THREE.CylinderGeometry(radius * 0.72, radius, spec.crownHeight * 0.45, 20);
  abutment.translate(0, spec.crownHeight * 0.2, 0);
  return finalize([fixture, abutment]);
}

/** Dark zig-zag crack running down the buccal face of the crown. */
export function buildCrackGeometry(spec: ToothSpec) {
  const points: THREE.Vector3[] = [];
  const steps = 7;
  for (let k = 0; k <= steps; k++) {
    const y = lerp(0.96, 0.35, k / steps);
    const { hx, hz } = crownExtent(spec, y);
    const x = (k % 2 === 0 ? -0.18 : 0.18) * hx + (k / steps) * hx * 0.2;
    const labial = spec.kind === "incisor" ? 0.35 * y * y : 0;
    points.push(new THREE.Vector3(x, y * spec.crownHeight, hz * Math.sqrt(Math.max(0, 1 - (x / hx) ** 2)) + labial + 0.05));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.1), 48, 0.16, 6, false);
}

/** A closed ellipse around the crown, used for the selection halo and missing-tooth outline. */
export function buildHaloGeometry(spec: ToothSpec, y: number, pad: number, tube: number) {
  const { hx, hz } = crownExtent(spec, 0.6);
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * (hx + pad), y, Math.sin(a) * (hz + pad)));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, tube, 6, true);
}

/** Dashed ellipse at the gum line marking an empty tooth position. */
export function buildDashedHaloGeometry(spec: ToothSpec, y: number, pad: number, tube: number, dashes = 14) {
  const { hx, hz } = crownExtent(spec, 0.6);
  const arcs: THREE.BufferGeometry[] = [];
  for (let d = 0; d < dashes; d++) {
    const a0 = (d / dashes) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / dashes / 1.8;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 6; k++) {
      const a = lerp(a0, a1, k / 6);
      pts.push(new THREE.Vector3(Math.cos(a) * (hx + pad), y, Math.sin(a) * (hz + pad)));
    }
    arcs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, tube, 5, false));
  }
  return finalize(arcs);
}

export type SurfacePlacement = {
  position: THREE.Vector3;
  scale: THREE.Vector3;
};

/**
 * Where a restoration or lesion sits for a given surface. The patch is a flattened
 * ellipsoid sunk slightly into the crown so it reads as inlaid, not stuck on.
 */
export function surfacePlacement(spec: ToothSpec, surface: ToothSurface, distalSign: number): SurfacePlacement {
  const h = spec.crownHeight;
  const anterior = spec.kind === "incisor" || spec.kind === "canine";
  const mid = crownExtent(spec, 0.55);
  const labialAt = (y: number) => (spec.kind === "incisor" ? 0.35 * y * y : 0);
  switch (surface) {
    case "Occlusal": {
      if (anterior) {
        const e = crownExtent(spec, 0.95);
        return {
          position: new THREE.Vector3(0, h * 0.95, labialAt(0.95)),
          scale: new THREE.Vector3(e.hx * 0.75, h * 0.08, Math.max(e.hz, 0.9) * 1.05),
        };
      }
      const e = crownExtent(spec, 0.9);
      return {
        position: new THREE.Vector3(0, h * 0.9, 0),
        scale: new THREE.Vector3(e.hx * 0.55, h * 0.1, e.hz * 0.4),
      };
    }
    case "Mesial":
    case "Distal": {
      const s = surface === "Distal" ? distalSign : -distalSign;
      return {
        position: new THREE.Vector3(s * (mid.hx - 0.45), h * 0.6, labialAt(0.6)),
        scale: new THREE.Vector3(0.75, h * 0.2, mid.hz * 0.45),
      };
    }
    case "Buccal":
      return {
        position: new THREE.Vector3(0, h * 0.5, mid.hz - 0.45 + labialAt(0.5)),
        scale: new THREE.Vector3(mid.hx * 0.4, h * 0.18, 0.75),
      };
    case "Lingual":
      return {
        position: new THREE.Vector3(0, h * 0.5, -mid.hz + 0.45 + labialAt(0.5)),
        scale: new THREE.Vector3(mid.hx * 0.4, h * 0.18, 0.75),
      };
  }
}

// ---------------------------------------------------------------------------
// Arch layout
// ---------------------------------------------------------------------------

export type ToothPlacement = {
  toothNumber: number;
  upper: boolean;
  spec: ToothSpec;
  /** Direction of distal in the tooth's geometry space (+1 / -1). */
  distalSign: number;
  /** World position of the CEJ centre. */
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  /** Arc-length parameter along the jaw's arch curve (0–1). */
  u: number;
  /** World position of the crown's centre (for bridge connectors, labels). */
  crownCenter: THREE.Vector3;
};

/** Vertical gap between upper and lower occlusal planes — mouth open enough to inspect both arches. */
export const OCCLUSAL_GAP = 12;

function archCurve(scaleX: number, offsetZ: number) {
  const half = [
    [0, 0],
    [9.5, -2.2],
    [17, -8],
    [21.5, -15.5],
    [24.5, -24],
    [26.5, -33.5],
    [28, -43.5],
    [29, -53.5],
    [29.8, -63],
  ];
  const pts = [
    ...[...half].reverse().map(([x, z]) => new THREE.Vector3(-x * scaleX, 0, z + offsetZ)),
    ...half.slice(1).map(([x, z]) => new THREE.Vector3(x * scaleX, 0, z + offsetZ)),
  ];
  return new THREE.CatmullRomCurve3(pts, false, "centripetal");
}

export const UPPER_ARCH = archCurve(1, 0);
export const LOWER_ARCH = archCurve(0.93, -1.8);

function placeQuadrant(numbers: number[], upper: boolean, side: 1 | -1): ToothPlacement[] {
  const curve = upper ? UPPER_ARCH : LOWER_ARCH;
  const total = curve.getLength();
  const up = new THREE.Vector3(0, 1, 0);
  const result: ToothPlacement[] = [];
  let s = 0;
  // `numbers` is ordered from the midline outwards once sorted by position.
  const ordered = [...numbers].sort((a, b) => (a % 10) - (b % 10));
  for (const n of ordered) {
    const spec = toothSpec(n);
    const half = spec.width / 2;
    s += half;
    const u = 0.5 + (side * s) / total;
    s += half + 0.25;

    const point = curve.getPointAt(u);
    const xAxis = curve.getTangentAt(u).normalize();
    const zAxis = new THREE.Vector3().crossVectors(xAxis, up).normalize();
    const basis = new THREE.Matrix4().makeBasis(xAxis, up, zAxis);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis);
    if (upper) quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI));

    const cejY = upper ? OCCLUSAL_GAP / 2 + spec.crownHeight : -OCCLUSAL_GAP / 2 - spec.crownHeight;
    const position = new THREE.Vector3(point.x, cejY, point.z);
    // Local +x is the arch tangent (towards the patient's left); flipped for the upper jaw.
    const distalSign = side * (upper ? -1 : 1);
    const crownCenter = new THREE.Vector3(0, spec.crownHeight * 0.55, 0).applyQuaternion(quaternion).add(position);

    result.push({ toothNumber: n, upper, spec, distalSign, position, quaternion, u, crownCenter });
  }
  return result;
}

/** Placement for every FDI tooth position (11–48). The patient's right is -x (viewer's left). */
export function buildDentitionLayout(): Map<number, ToothPlacement> {
  const all = [
    ...placeQuadrant(UPPER_RIGHT, true, -1),
    ...placeQuadrant(UPPER_LEFT, true, 1),
    ...placeQuadrant(LOWER_RIGHT, false, -1),
    ...placeQuadrant(LOWER_LEFT, false, 1),
  ];
  return new Map(all.map((p) => [p.toothNumber, p]));
}

/** Teeth in arch order (patient right → left) for one jaw, for finding neighbours. */
export function archOrder(upper: boolean) {
  return upper
    ? [...UPPER_RIGHT, ...UPPER_LEFT]
    : [...[...LOWER_RIGHT].reverse(), ...LOWER_LEFT];
}

// Muted, natural gingival tones (sRGB) rather than a saturated pink.
const GINGIVA = {
  margin: new THREE.Color("#e3a59c"),
  papilla: new THREE.Color("#e9b2a8"),
  attached: new THREE.Color("#d69089"),
  mucosa: new THREE.Color("#c4716e"),
};

/**
 * Gingiva as a swept, scalloped profile along the arch: the crest dips at each
 * tooth's centre and rises into papillae between teeth, following the CEJ line.
 */
export function buildGumGeometry(placements: ToothPlacement[], upper: boolean) {
  const curve = upper ? UPPER_ARCH : LOWER_ARCH;
  const total = curve.getLength();
  const sorted = [...placements].sort((a, b) => a.u - b.u);
  const dir = upper ? 1 : -1; // direction the roots point in world y
  const uMin = sorted[0].u - (sorted[0].spec.width / 2 + 3) / total;
  const uMax = sorted[sorted.length - 1].u + (sorted[sorted.length - 1].spec.width / 2 + 3) / total;

  const samples = 220;
  const ring = 28;
  const positions: number[] = [];
  const colors: number[] = [];
  const c = new THREE.Color();
  const indices: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  // One smooth base for the whole jaw, deep enough for the longest root (canines ~17mm),
  // so only the gum line is scalloped and the body reads as a calm, continuous form.
  const deepestCej = upper ? Math.max(...sorted.map((p) => p.position.y)) : Math.min(...sorted.map((p) => p.position.y));
  const base = deepestCej + dir * (Math.max(...sorted.map((p) => p.spec.rootLength)) + 3.5);

  const interp = (u: number) => {
    let i = 0;
    while (i < sorted.length - 1 && sorted[i + 1].u < u) i++;
    const a = sorted[i];
    const b = sorted[Math.min(i + 1, sorted.length - 1)];
    const t = a === b ? 0 : clamp01((u - a.u) / (b.u - a.u));
    const nearest = Math.abs(u - a.u) < Math.abs(u - b.u) ? a : b;
    const halfW = nearest.spec.width / 2;
    const dist = Math.min(1, (Math.abs(u - nearest.u) * total) / halfW);
    return {
      cej: lerp(a.position.y, b.position.y, t),
      depth: lerp(a.spec.depth, b.spec.depth, t),
      scallop: dist * dist,
    };
  };

  for (let i = 0; i <= samples; i++) {
    const u = clamp01(lerp(uMin, uMax, i / samples));
    const point = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u).normalize();
    const outward = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const { cej, depth, scallop } = interp(u);
    // Crest sits ~0.8mm over the CEJ at mid-tooth and ~2.8mm at the papillae.
    const crest = cej - dir * (0.8 + 2 * scallop);
    const height = Math.abs(base - crest);
    const halfWidth = depth / 2 + 1.6;
    for (let k = 0; k < ring; k++) {
      const a = (k / ring) * Math.PI * 2;
      // Alveolar bulge: fullest just below the gum line, tapering towards the base.
      const sinA = Math.sin(a);
      const t = (1 - Math.sign(sinA) * Math.abs(sinA) ** 0.8) / 2; // 0 at the crest, 1 at the base
      const across = Math.cos(a) * halfWidth * (1 - 0.18 * smoothstep(0.55, 1, t));
      const y = lerp(crest, base, t);
      positions.push(point.x + outward.x * across, y, point.z + outward.z * across);
      // Free gingiva at the margin is paler; attached gingiva deepens towards the vestibule.
      const fromCrest = clamp01(Math.abs(y - crest) / height);
      c.copy(GINGIVA.margin).lerp(GINGIVA.attached, smoothstep(0.02, 0.3, fromCrest));
      c.lerp(GINGIVA.mucosa, smoothstep(0.45, 1, fromCrest));
      c.lerp(GINGIVA.papilla, scallop * (1 - smoothstep(0, 0.12, fromCrest)) * 0.6);
      colors.push(c.r, c.g, c.b);
    }
  }

  for (let i = 0; i < samples; i++) {
    for (let k = 0; k < ring; k++) {
      const a = i * ring + k;
      const b = i * ring + ((k + 1) % ring);
      const c = (i + 1) * ring + k;
      const d = (i + 1) * ring + ((k + 1) % ring);
      if (upper) indices.push(a, b, c, b, d, c);
      else indices.push(a, c, b, b, c, d);
    }
  }

  // Cap both ends with a fan.
  const capCenter = (i: number) => {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < ring; k++) {
      x += positions[(i * ring + k) * 3];
      y += positions[(i * ring + k) * 3 + 1];
      z += positions[(i * ring + k) * 3 + 2];
    }
    positions.push(x / ring, y / ring, z / ring);
    colors.push(GINGIVA.mucosa.r, GINGIVA.mucosa.g, GINGIVA.mucosa.b);
    return positions.length / 3 - 1;
  };
  const startCap = capCenter(0);
  const endCap = capCenter(samples);
  for (let k = 0; k < ring; k++) {
    const k2 = (k + 1) % ring;
    if (upper) {
      indices.push(startCap, k2, k);
      indices.push(endCap, samples * ring + k, samples * ring + k2);
    } else {
      indices.push(startCap, k, k2);
      indices.push(endCap, samples * ring + k2, samples * ring + k);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
