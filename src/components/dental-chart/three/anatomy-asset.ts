"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { LOWER_LEFT, LOWER_RIGHT, UPPER_LEFT, UPPER_RIGHT } from "@/lib/dental";
import { sourceGeometries, type AnatomySource, type LayerPart, type ToothAnatomy } from "./anatomy";
import { isUpper, toothSpec, type ToothPlacement } from "./tooth-geometry";

/*
 * Reads a supplied anatomical GLB into an AnatomySource. The naming and coordinate
 * contract is documented in docs/dental-3d-model-spec.md:
 *
 *   tooth_<FDI>            empty/group whose origin is the tooth's CEJ centre,
 *                          +Y occlusal, +Z buccal, +X towards the patient's left
 *     tooth_<FDI>_enamel   required
 *     tooth_<FDI>_dentin   root + coronal dentin (cementum may be included)
 *     tooth_<FDI>_pulp     pulp chamber and canals
 *     tooth_<FDI>_nerve    neurovascular bundle (optional)
 *   gingiva_upper / gingiva_lower, maxilla / mandible   (optional)
 *
 * Units are millimetres; a model authored in metres is detected and scaled.
 */

const ALL_TEETH = [...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_LEFT, ...LOWER_RIGHT];

function firstMesh(object: THREE.Object3D | undefined) {
  if (!object) return undefined;
  if ((object as THREE.Mesh).isMesh) return object as THREE.Mesh;
  let found: THREE.Mesh | undefined;
  object.traverse((o) => {
    if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh;
  });
  return found;
}

/**
 * Quantized (KHR_mesh_quantization) attributes are normalized integers; transforming
 * them in place would clip, so bake from plain floats.
 */
function toFloat(geometry: THREE.BufferGeometry) {
  for (const name of ["position", "normal"]) {
    const attr = geometry.getAttribute(name);
    if (!attr || attr.array instanceof Float32Array) continue;
    const out = new Float32Array(attr.count * attr.itemSize);
    for (let i = 0; i < attr.count; i++) {
      out[i * attr.itemSize] = attr.getX(i);
      out[i * attr.itemSize + 1] = attr.getY(i);
      if (attr.itemSize > 2) out[i * attr.itemSize + 2] = attr.getZ(i);
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(out, attr.itemSize));
  }
  return geometry;
}

/** Geometry baked into `frame` (or world space when no frame is given), with the mesh's own material. */
function bake(mesh: THREE.Mesh | undefined, units: THREE.Matrix4, frameInverse?: THREE.Matrix4): LayerPart | undefined {
  if (!mesh) return undefined;
  const m = new THREE.Matrix4().multiplyMatrices(units, mesh.matrixWorld);
  if (frameInverse) m.premultiply(frameInverse);
  const geometry = toFloat(mesh.geometry.clone()).applyMatrix4(m);
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return { geometry, material: Array.isArray(mesh.material) ? mesh.material[0] : mesh.material };
}

export function anatomyFromGltf(scene: THREE.Object3D, url: string): AnatomySource {
  scene.updateMatrixWorld(true);
  const warnings: string[] = [];

  // Millimetres expected: a whole dentition is ~60mm wide. Under 1 unit across means metres.
  const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
  const unitScale = Math.max(size.x, size.y, size.z) < 1 ? 1000 : 1;
  if (unitScale !== 1) warnings.push("Model is in metres; scaled to millimetres.");
  const units = new THREE.Matrix4().makeScale(unitScale, unitScale, unitScale);

  const layout = new Map<number, ToothPlacement>();
  const teeth = new Map<number, ToothAnatomy>();
  const missing: number[] = [];
  const noLayer = { dentin: [] as number[], pulp: [] as number[] };

  for (const n of ALL_TEETH) {
    const node = scene.getObjectByName(`tooth_${n}`);
    const enamelMesh = firstMesh(scene.getObjectByName(`tooth_${n}_enamel`));
    if (!node || !enamelMesh) {
      missing.push(n);
      continue;
    }
    // Rigid frame of the tooth (scale is baked into the geometry instead).
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    new THREE.Matrix4().multiplyMatrices(units, node.matrixWorld).decompose(position, quaternion, new THREE.Vector3());
    const frameInverse = new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(1, 1, 1)).invert();

    const enamel = bake(enamelMesh, units, frameInverse)!;
    const dentin = bake(firstMesh(scene.getObjectByName(`tooth_${n}_dentin`)), units, frameInverse);
    const pulp = bake(firstMesh(scene.getObjectByName(`tooth_${n}_pulp`)), units, frameInverse);
    const nerve = bake(firstMesh(scene.getObjectByName(`tooth_${n}_nerve`)), units, frameInverse);
    if (!dentin) noLayer.dentin.push(n);
    if (!pulp) noLayer.pulp.push(n);

    // Proportions measured from the model, so restorations and labels sit on its surfaces.
    // A crowns-only model can say how deep its gum reaches (node extras `rootLength`, mm),
    // which bounds what is drawn below the crown, such as an implant post.
    const crown = enamel.geometry.boundingBox!;
    const base = toothSpec(n);
    const declaredRoot = Number(node.userData?.rootLength);
    const spec = {
      ...base,
      width: crown.max.x - crown.min.x,
      depth: crown.max.z - crown.min.z,
      crownHeight: Math.max(crown.max.y, 1),
      rootLength: dentin
        ? Math.max(-dentin.geometry.boundingBox!.min.y, 1)
        : declaredRoot > 0
          ? declaredRoot * unitScale
          : base.rootLength,
    };
    const upper = isUpper(n);
    const q = Math.floor(n / 10);
    const side = q === 2 || q === 3 ? 1 : -1;
    layout.set(n, {
      toothNumber: n,
      upper,
      spec,
      distalSign: side * (upper ? -1 : 1),
      position,
      quaternion,
      u: 0,
      crownCenter: new THREE.Vector3(0, spec.crownHeight * 0.55, 0).applyQuaternion(quaternion).add(position),
    });
    teeth.set(n, { enamel, dentin: dentin ? [dentin] : [], pulp, nerve });
  }

  if (teeth.size === 0) {
    throw new Error(`No tooth_<FDI> / tooth_<FDI>_enamel nodes found in ${url}`);
  }
  if (missing.length) warnings.push(`Not in model: ${missing.join(", ")}`);
  // A layer the whole model lacks is simply unavailable; only partial coverage is a problem.
  if (noLayer.dentin.length && noLayer.dentin.length < teeth.size) warnings.push(`No dentin layer: ${noLayer.dentin.join(", ")}`);
  if (noLayer.pulp.length && noLayer.pulp.length < teeth.size) warnings.push(`No pulp layer: ${noLayer.pulp.join(", ")}`);

  const pick = (name: string) => bake(firstMesh(scene.getObjectByName(name)), units);
  const gums = { upper: pick("gingiva_upper"), lower: pick("gingiva_lower") };
  const bone = { upper: pick("maxilla"), lower: pick("mandible") };
  const all = [...teeth.values()];
  // Optional metadata the model carries in its scene extras (see the spec).
  const meta = (scene.userData?.dentalhub ?? {}) as { description?: string; credit?: string; creditUrl?: string };

  const source: AnatomySource = {
    kind: "asset",
    description: meta.description || "Anatomical model",
    credit: meta.credit ? { text: meta.credit, url: meta.creditUrl } : undefined,
    layout,
    teeth,
    gums,
    bone,
    available: {
      enamel: true,
      dentin: all.some((t) => t.dentin.length > 0),
      pulp: all.some((t) => t.pulp),
      nerve: all.some((t) => t.nerve),
      bone: Boolean(bone.upper || bone.lower),
    },
    warnings,
    // Only our baked copies are disposed; the GLB's materials stay with the loader cache.
    dispose: () => sourceGeometries(source).forEach((g) => g.dispose()),
  };
  return source;
}

/**
 * Loads the GLB (Meshopt-compressed meshes are decoded locally; no CDN decoders) and
 * hands the parsed source up. Suspends while downloading and throws on failure, so
 * it must sit inside <Suspense> and an error boundary.
 */
export function AssetAnatomyLoader({ url, onLoaded }: { url: string; onLoaded: (source: AnatomySource) => void }) {
  const gltf = useGLTF(url, false, true);
  const source = useMemo(() => anatomyFromGltf(gltf.scene, url), [gltf, url]);
  const callback = useRef(onLoaded);
  useEffect(() => {
    callback.current = onLoaded;
  }, [onLoaded]);
  useEffect(() => {
    callback.current(source);
    return () => source.dispose();
  }, [source]);
  return null;
}
