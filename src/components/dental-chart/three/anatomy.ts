import * as THREE from "three";
import {
  buildCanalGeometry,
  buildCrownGeometry,
  buildDentinCrownGeometry,
  buildDentitionLayout,
  buildGumGeometry,
  buildRootGeometry,
  type ToothPlacement,
} from "./tooth-geometry";

/*
 * The 3D chart renders from an AnatomySource, so the same selection, status,
 * label, focus and cross-section code works for both the built-in procedural
 * dentition and a supplied anatomical GLB model (see ./anatomy-asset.ts and
 * docs/dental-3d-model-spec.md).
 *
 * Tooth geometry is in the tooth's own frame: origin at the cemento-enamel
 * junction, +y occlusal/incisal, +z buccal/labial, millimetres. `placement` puts
 * that frame in the arch.
 */

export type AnatomyLayer = "enamel" | "dentin" | "pulp" | "nerve" | "bone";

export type LayerPart = {
  geometry: THREE.BufferGeometry;
  /** The asset's own material; procedural parts use the scene's shared materials. */
  material?: THREE.Material;
  /** Sits inside the enamel (coronal dentin) — only drawn when enamel is hidden or the tooth is sectioned. */
  internal?: boolean;
};

export type ToothAnatomy = {
  /** Crown enamel. Restorations and lesions are drawn on this layer. */
  enamel: LayerPart;
  /** Root (and coronal) dentin with cementum. */
  dentin: LayerPart[];
  /** Pulp chamber and canals. */
  pulp?: LayerPart;
  /** Neurovascular bundle — only when the model provides it. */
  nerve?: LayerPart;
};

export type AnatomySource = {
  kind: "procedural" | "asset";
  /** Shown in the viewer so nobody mistakes a schematic for a scanned anatomy. */
  description: string;
  /** Attribution the model's licence requires, shown in the viewer. */
  credit?: { text: string; url?: string };
  layout: Map<number, ToothPlacement>;
  teeth: Map<number, ToothAnatomy>;
  gums: { upper?: LayerPart; lower?: LayerPart };
  bone: { upper?: LayerPart; lower?: LayerPart };
  /** Which optional layers this source can actually show. */
  available: Record<AnatomyLayer, boolean>;
  /** Problems found while reading an asset (missing teeth or layers). */
  warnings: string[];
  dispose: () => void;
};

/** Every geometry in a source, for disposal. */
export function sourceGeometries(source: Pick<AnatomySource, "teeth" | "gums" | "bone">) {
  const out: THREE.BufferGeometry[] = [];
  for (const t of source.teeth.values()) {
    out.push(t.enamel.geometry, ...t.dentin.map((d) => d.geometry));
    if (t.pulp) out.push(t.pulp.geometry);
    if (t.nerve) out.push(t.nerve.geometry);
  }
  for (const part of [source.gums.upper, source.gums.lower, source.bone.upper, source.bone.lower]) {
    if (part) out.push(part.geometry);
  }
  return out;
}

/**
 * Built-in dentition: average-proportioned permanent teeth with schematic enamel,
 * dentin and pulp layers. Good for orientation and charting; it is not derived from
 * scans, and has no neurovascular structures or jaw bone.
 */
export function proceduralAnatomy(): AnatomySource {
  const layout = buildDentitionLayout();
  const teeth = new Map<number, ToothAnatomy>();
  for (const p of layout.values()) {
    const lower = !p.upper;
    teeth.set(p.toothNumber, {
      enamel: { geometry: buildCrownGeometry(p.spec, p.distalSign, lower) },
      dentin: [
        { geometry: buildRootGeometry(p.spec, p.distalSign) },
        { geometry: buildDentinCrownGeometry(p.spec, p.distalSign, lower), internal: true },
      ],
      pulp: { geometry: buildCanalGeometry(p.spec, p.distalSign) },
    });
  }
  const all = [...layout.values()];
  const source: AnatomySource = {
    kind: "procedural",
    description: "Schematic model — average tooth proportions, not patient anatomy",
    layout,
    teeth,
    gums: {
      upper: { geometry: buildGumGeometry(all.filter((p) => p.upper), true) },
      lower: { geometry: buildGumGeometry(all.filter((p) => !p.upper), false) },
    },
    bone: {},
    available: { enamel: true, dentin: true, pulp: true, nerve: false, bone: false },
    warnings: [],
    dispose: () => sourceGeometries(source).forEach((g) => g.dispose()),
  };
  return source;
}
