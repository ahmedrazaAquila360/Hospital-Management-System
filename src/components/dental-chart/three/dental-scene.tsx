"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Billboard, CameraControls, CameraControlsImpl, Environment, Lightformer, useCursor } from "@react-three/drei";
import { CONDITION_META, toothName, type ToothConditionKey, type ToothSurface } from "@/lib/dental";
import { cn } from "@/lib/utils";
import {
  archOrder,
  buildCrackGeometry,
  buildDashedHaloGeometry,
  buildHaloGeometry,
  buildImplantGeometry,
  crownExtent,
  surfacePlacement,
  type ToothPlacement,
} from "./tooth-geometry";
import { proceduralAnatomy, type AnatomyLayer, type AnatomySource, type LayerPart, type ToothAnatomy } from "./anatomy";
import { defaultSurface } from "./visual-states";
import { AssetAnatomyLoader } from "./anatomy-asset";

/** Catches a failed model download/parse inside the canvas so the schematic model can take over. */
class AssetBoundary extends Component<{ children: ReactNode; onError: (reason: string) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error instanceof Error ? error.message : String(error));
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export type JawView = "full" | "upper" | "lower";
export type CameraPreset = "front" | "left" | "right" | "occlusal";
/** Solid gingiva, see-through gingiva (roots visible), or none. */
export type GumMode = "solid" | "translucent" | "hidden";
/** Whole dentition, the selected tooth alone, or it with two neighbours each side. */
export type IsolateMode = "all" | "tooth" | "neighbors";

/** Imperative handle the toolbar uses for screenshots, zoom buttons and view thumbnails. */
export type DentalSceneApi = {
  /** PNG of the current view with visible tooth-number pills drawn in; no patient details. */
  capture: () => string;
  /** Step the camera in (+1) or out (-1). */
  zoom: (direction: 1 | -1) => void;
  /** Small renders of the full mouth from each preset (the occlusal one shows the lower arch). */
  views: () => Partial<Record<CameraPreset, string>>;
};

/** What a left-drag (or one-finger drag) does. */
export type DragMode = "rotate" | "pan";

export type SceneTooth = {
  toothNumber: number;
  condition: ToothConditionKey;
  surfaces: ToothSurface[];
  /** Faded out while the status legend highlights a different condition. */
  dimmed?: boolean;
};

export type DentalSceneProps = {
  teeth: SceneTooth[];
  selected: number | null;
  onSelect: (toothNumber: number) => void;
  jaw: JawView;
  gumMode: GumMode;
  isolate: IsolateMode;
  /** When off, every present tooth is drawn as natural anatomy (missing teeth stay absent). */
  showStatus: boolean;
  showLabels: boolean;
  /** `focus` aims at the selected tooth instead of a preset. */
  camera: { preset: CameraPreset | "focus"; nonce: number };
  /** Anatomical layers to draw (unavailable ones are ignored). */
  layers: Record<AnatomyLayer, boolean>;
  /** Show the selected tooth in cross-section. */
  section: boolean;
  dragMode?: DragMode;
  /** URL of a supplied anatomical GLB; without one the built-in schematic model is used. */
  modelUrl?: string | null;
  onApi?: (api: DentalSceneApi | null) => void;
  onSourceChange?: (info: SourceInfo) => void;
  /** The browser dropped the WebGL context (GPU reset, too many contexts). */
  onContextLost?: () => void;
};

/** What the toolbar needs to know about the model being shown. */
export type SourceInfo =
  | { status: "loading" }
  | {
      status: "ready";
      kind: AnatomySource["kind"];
      description: string;
      credit?: AnatomySource["credit"];
      available: AnatomySource["available"];
      warnings: string[];
      /** Set when a supplied model failed and the schematic model is shown instead. */
      fallbackReason?: string;
    };

// ---------------------------------------------------------------------------
// Materials — created once per mounted scene and shared between teeth.
// ---------------------------------------------------------------------------

/**
 * Clearcoat and sheen each add a shader path; phones and weak GPUs skip them (three.js
 * only compiles a feature when its strength is above zero).
 */
function simplifyForLowPower(material: THREE.Material) {
  if (material instanceof THREE.MeshPhysicalMaterial) {
    material.clearcoat = 0;
    material.sheen = 0;
  }
}

function createMaterials() {
  // Neutral white base: the crown/root/gum geometry carries its own vertex colours
  // (enamel gradient, cementum, gingiva) with occlusion baked in.
  const enamel = new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    vertexColors: true,
    roughness: 0.36,
    specularIntensity: 0.55,
    clearcoat: 0.3,
    clearcoatRoughness: 0.32,
    sheen: 0.25,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color("#fff3e2"),
  });
  const gumBase = {
    color: "#ffffff",
    vertexColors: true,
    roughness: 0.5,
    clearcoat: 0.18,
    clearcoatRoughness: 0.45,
    sheen: 0.4,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color("#ffd9d2"),
  } satisfies THREE.MeshPhysicalMaterialParameters;
  // Back-face shells drawn slightly larger than the crown read as an outline, so a
  // selected tooth keeps its natural colour and anatomy.
  const outline = (color: string, opacity: number) =>
    new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, transparent: opacity < 1, opacity, depthWrite: false });
  return {
    enamel,
    root: new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.62 }),
    rootGlass: new THREE.MeshStandardMaterial({
      color: "#ffffff",
      vertexColors: true,
      roughness: 0.5,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    }),
    canal: new THREE.MeshStandardMaterial({ color: "#e4553f", roughness: 0.35, emissive: "#8a1d10", emissiveIntensity: 0.35 }),
    // Vital pulp: soft, vascular pink-red (shown when sectioned or with dentin hidden).
    pulp: new THREE.MeshPhysicalMaterial({ color: "#d4767c", roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color("#ffc4c4") }),
    nerve: new THREE.MeshStandardMaterial({ color: "#e9cf74", roughness: 0.5 }),
    // Composite resin is tooth-coloured in reality; a cool tint keeps it identifiable.
    filling: new THREE.MeshPhysicalMaterial({ color: "#7cc4dc", roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
    access: new THREE.MeshPhysicalMaterial({ color: "#c9cfd6", roughness: 0.3, metalness: 0.4, clearcoat: 0.6 }),
    caries: new THREE.MeshStandardMaterial({ color: "#4a2a17", roughness: 0.95 }),
    gold: new THREE.MeshPhysicalMaterial({ color: "#dcae55", metalness: 0.85, roughness: 0.3, clearcoat: 0.3 }),
    porcelain: new THREE.MeshPhysicalMaterial({ color: "#f6f3ec", roughness: 0.2, clearcoat: 0.7, clearcoatRoughness: 0.12 }),
    bridgeCeramic: new THREE.MeshPhysicalMaterial({ color: "#eceef5", roughness: 0.2, clearcoat: 0.7 }),
    bridgeBar: new THREE.MeshStandardMaterial({ color: "#6d64c9", roughness: 0.35, metalness: 0.3, transparent: true, opacity: 0.85 }),
    titanium: new THREE.MeshStandardMaterial({ color: "#8f98a3", metalness: 1, roughness: 0.3 }),
    other: new THREE.MeshPhysicalMaterial({ color: "#d9eedf", roughness: 0.3, clearcoat: 0.5 }),
    extraction: new THREE.MeshPhysicalMaterial({
      color: "#c9ced6",
      roughness: 0.5,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    }),
    ghost: new THREE.MeshBasicMaterial({ color: "#94a3b8", transparent: true, opacity: 0.1, depthWrite: false }),
    missingRing: new THREE.MeshBasicMaterial({ color: "#64748b", transparent: true, opacity: 0.85 }),
    crack: new THREE.MeshBasicMaterial({ color: "#241509" }),
    cross: new THREE.MeshBasicMaterial({ color: "#dc2626" }),
    halo: new THREE.MeshBasicMaterial({ color: "#0875ba", transparent: true, opacity: 0.9 }),
    dimmed: new THREE.MeshStandardMaterial({
      color: "#cbd2dc",
      roughness: 0.6,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
    hoverShell: outline("#21bce8", 0.75),
    selectShell: outline("#0875ba", 1),
    gum: new THREE.MeshPhysicalMaterial({ ...gumBase, side: THREE.FrontSide }),
    gumGlass: new THREE.MeshPhysicalMaterial({
      ...gumBase,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  };
}

type Materials = ReturnType<typeof createMaterials>;

function crownMaterialFor(condition: ToothConditionKey, m: Materials) {
  switch (condition) {
    case "CROWN":
      return m.gold;
    case "IMPLANT":
      return m.porcelain;
    case "BRIDGE":
      return m.bridgeCeramic;
    case "OTHER":
      return m.other;
    case "EXTRACTION":
      return m.extraction;
    case "MISSING":
      return m.ghost;
    default:
      return m.enamel;
  }
}

// ---------------------------------------------------------------------------
// Geometry cache — built lazily per tooth, disposed with the scene.
// ---------------------------------------------------------------------------

/** Status overlays built from the tooth's proportions; the anatomy itself comes from the AnatomySource. */
type GeoKind = "implant" | "crack" | "halo" | "missing";

class GeometryCache {
  private cache = new Map<string, THREE.BufferGeometry>();
  readonly unitSphere = new THREE.SphereGeometry(1, 24, 16);

  constructor(private layout: Map<number, ToothPlacement>) {}

  get(n: number, kind: GeoKind) {
    const key = `${n}:${kind}`;
    let g = this.cache.get(key);
    if (!g) {
      const { spec } = this.layout.get(n)!;
      switch (kind) {
        case "implant":
          g = buildImplantGeometry(spec);
          break;
        case "crack":
          g = buildCrackGeometry(spec);
          break;
        case "halo":
          g = buildHaloGeometry(spec, spec.crownHeight * 0.12, 1.1, 0.28);
          break;
        case "missing":
          g = buildDashedHaloGeometry(spec, 1.2, 0.2, 0.3);
          break;
      }
      this.cache.set(key, g);
    }
    return g;
  }

  dispose() {
    this.cache.forEach((g) => g.dispose());
    this.cache.clear();
    this.unitSphere.dispose();
  }
}

// ---------------------------------------------------------------------------
// Tooth
// ---------------------------------------------------------------------------

const OUTLINE_SCALE: [number, number, number] = [1.05, 1.03, 1.05];
const OUTLINE_SCALE_SELECTED: [number, number, number] = [1.075, 1.04, 1.075];

// Flat colours for the cut faces of a sectioned tooth.
const CAP_COLOURS = { enamel: "#efe8da", dentin: "#d9bc84", pulp: "#bf5a63", nerve: "#e2c35a" } as const;

/**
 * Cross-section without touching the model: every material on the sectioned tooth
 * is swapped for a clipped copy, and its back faces are drawn in a flat cap colour,
 * which reads as a solid cut surface (enamel → dentin → pulp) from the open side.
 */
class SectionKit {
  readonly plane = new THREE.Plane();
  private clipped = new Map<THREE.Material, THREE.Material>();
  private caps = new Map<string, THREE.MeshBasicMaterial>();

  material(m: THREE.Material) {
    let c = this.clipped.get(m);
    if (!c) {
      c = m.clone();
      c.clippingPlanes = [this.plane];
      c.side = THREE.FrontSide;
      this.clipped.set(m, c);
    }
    return c;
  }

  cap(colour: string) {
    let c = this.caps.get(colour);
    if (!c) {
      c = new THREE.MeshBasicMaterial({ color: colour, side: THREE.BackSide, clippingPlanes: [this.plane] });
      this.caps.set(colour, c);
    }
    return c;
  }

  /** Keeps the lingual half of the tooth, so the cut face looks at a camera on the buccal side. */
  aim(placement: ToothPlacement) {
    const lingual = new THREE.Vector3(0, 0, -1).applyQuaternion(placement.quaternion);
    this.plane.setFromNormalAndCoplanarPoint(lingual, placement.position);
  }

  dispose() {
    this.clipped.forEach((m) => m.dispose());
    this.caps.forEach((m) => m.dispose());
  }
}

/** A mesh that, on a sectioned tooth, becomes a clipped mesh plus its cut-face cap. */
function Part({
  geometry,
  material,
  section,
  cap,
  renderOrder,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  section: SectionKit | null;
  cap: string;
  renderOrder?: number;
}) {
  if (!section) return <mesh geometry={geometry} material={material} renderOrder={renderOrder} />;
  return (
    <>
      <mesh geometry={geometry} material={section.material(material)} renderOrder={renderOrder} />
      <mesh geometry={geometry} material={section.cap(cap)} raycast={() => null} />
    </>
  );
}

function ToothModel({
  placement,
  anatomy,
  tooth,
  materials,
  geo,
  layers,
  section,
  selected,
  hovered,
  onHover,
  onSelect,
}: {
  placement: ToothPlacement;
  anatomy: ToothAnatomy;
  tooth: SceneTooth;
  materials: Materials;
  geo: GeometryCache;
  layers: Record<AnatomyLayer, boolean>;
  /** Set when this tooth is shown in cross-section. */
  section: SectionKit | null;
  selected: boolean;
  hovered: boolean;
  onHover: (n: number | null) => void;
  onSelect: (n: number) => void;
}) {
  const { toothNumber: n, spec } = placement;
  const condition = tooth.condition;

  const surfaces = tooth.surfaces.length > 0 ? tooth.surfaces : [defaultSurface(n)];
  const hasNaturalRoot = condition !== "MISSING" && condition !== "IMPLANT";
  const extent = crownExtent(spec, 0.55);
  const enamelOn = layers.enamel;
  const dentinParts = hasNaturalRoot && layers.dentin ? anatomy.dentin.filter((d) => !d.internal || !enamelOn || section) : [];

  function handleOver(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    onHover(n);
  }
  function handleOut(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    onHover(null);
  }
  function handleClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    // Ignore the click that ends a rotate/pan drag.
    if (e.delta > 6) return;
    onSelect(n);
  }

  if (tooth.dimmed && !selected) {
    // Highlight mode: fade teeth that don't match the chosen status (still clickable).
    return (
      <group
        name={`tooth_${n}`}
        position={placement.position}
        quaternion={placement.quaternion}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        {enamelOn && <mesh geometry={anatomy.enamel.geometry} material={materials.dimmed} />}
        {dentinParts.map((d, i) => (
          <mesh key={i} geometry={d.geometry} material={materials.dimmed} />
        ))}
        {hovered && enamelOn && (
          <mesh geometry={anatomy.enamel.geometry} material={materials.hoverShell} scale={OUTLINE_SCALE} raycast={() => null} />
        )}
      </group>
    );
  }

  // Natural enamel keeps the model's own material when it has one; statuses replace it.
  const enamelMaterial =
    condition === "HEALTHY" || condition === "CARIES" || condition === "FILLED" || condition === "FRACTURE" || condition === "ROOT_CANAL"
      ? anatomy.enamel.material ?? materials.enamel
      : crownMaterialFor(condition, materials);
  const rootCanal = condition === "ROOT_CANAL";
  // The pulp is enclosed by dentin, so it is only worth drawing when something exposes it.
  // Models without a pulp layer show root-canal treatment by its access cavity and label
  // only: schematic canals can't be fitted inside a scanned root reliably.
  const pulpGeometry = anatomy.pulp?.geometry;
  const showPulp = pulpGeometry && hasNaturalRoot && (rootCanal || (layers.pulp && (section || !layers.dentin)));
  const showNerve = anatomy.nerve && hasNaturalRoot && layers.nerve && !rootCanal;

  return (
    <group
      name={`tooth_${n}`}
      userData={{ toothNumber: n, toothName: toothName(n), jaw: placement.upper ? "upper" : "lower", condition }}
      position={placement.position}
      quaternion={placement.quaternion}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
      onClick={handleClick}
    >
      {enamelOn && (
        <Part
          geometry={anatomy.enamel.geometry}
          material={enamelMaterial}
          section={section}
          cap={CAP_COLOURS.enamel}
          renderOrder={condition === "MISSING" ? 2 : 0}
        />
      )}
      {(hovered || selected) && enamelOn && !section && condition !== "MISSING" && (
        <mesh
          geometry={anatomy.enamel.geometry}
          material={selected ? materials.selectShell : materials.hoverShell}
          scale={selected ? OUTLINE_SCALE_SELECTED : OUTLINE_SCALE}
          raycast={() => null}
        />
      )}

      {dentinParts.map((d, i) => (
        <Part
          key={i}
          geometry={d.geometry}
          material={rootCanal && !section ? materials.rootGlass : d.material ?? materials.root}
          section={section}
          cap={CAP_COLOURS.dentin}
        />
      ))}

      {showPulp && (
        <Part
          geometry={pulpGeometry}
          // A root-canal-treated tooth has no vital pulp: its canals are obturated.
          material={rootCanal ? materials.canal : (anatomy.pulp?.material ?? materials.pulp)}
          section={section}
          cap={rootCanal ? "#c2462f" : CAP_COLOURS.pulp}
        />
      )}
      {showNerve && (
        <Part geometry={anatomy.nerve!.geometry} material={anatomy.nerve!.material ?? materials.nerve} section={section} cap={CAP_COLOURS.nerve} />
      )}

      {enamelOn && rootCanal && (
        <SurfacePatch placement={placement} surface="Occlusal" scale={0.7} material={materials.access} geo={geo} section={section} />
      )}

      {enamelOn &&
        (condition === "FILLED" || condition === "CARIES") &&
        surfaces.map((s) => (
          <SurfacePatch
            key={s}
            placement={placement}
            surface={s}
            scale={condition === "CARIES" ? 0.8 : 1}
            material={condition === "CARIES" ? materials.caries : materials.filling}
            geo={geo}
            section={section}
          />
        ))}

      {condition === "IMPLANT" && (
        <Part geometry={geo.get(n, "implant")} material={materials.titanium} section={section} cap="#7d8792" />
      )}

      {enamelOn && condition === "FRACTURE" && <mesh geometry={geo.get(n, "crack")} material={materials.crack} />}

      {condition === "MISSING" && <mesh geometry={geo.get(n, "missing")} material={materials.missingRing} />}

      {condition === "EXTRACTION" && (
        <Billboard position={[0, spec.crownHeight * 0.5, extent.hz + 2.5]}>
          <mesh rotation-z={Math.PI / 4} material={materials.cross} renderOrder={10}>
            <boxGeometry args={[7, 1.2, 0.3]} />
          </mesh>
          <mesh rotation-z={-Math.PI / 4} material={materials.cross} renderOrder={10}>
            <boxGeometry args={[7, 1.2, 0.3]} />
          </mesh>
        </Billboard>
      )}

      {selected && !section && <mesh geometry={geo.get(n, "halo")} material={materials.halo} raycast={() => null} />}
    </group>
  );
}

function SurfacePatch({
  placement,
  surface,
  scale,
  material,
  geo,
  section,
}: {
  placement: ToothPlacement;
  surface: ToothSurface;
  scale: number;
  material: THREE.Material;
  geo: GeometryCache;
  section: SectionKit | null;
}) {
  const { position, scale: s } = surfacePlacement(placement.spec, surface, placement.distalSign);
  return (
    <mesh
      geometry={geo.unitSphere}
      material={section ? section.material(material) : material}
      position={position}
      scale={[s.x * scale, s.y * scale, s.z * scale]}
    />
  );
}

/** Coloured bar along the buccal faces tying consecutive bridge units together. */
function BridgeBars({
  layout,
  teeth,
  materials,
  upper,
}: {
  layout: Map<number, ToothPlacement>;
  teeth: Map<number, SceneTooth>;
  materials: Materials;
  upper: boolean;
}) {
  const geometries = useMemo(() => {
    const runs: number[][] = [];
    let run: number[] = [];
    for (const n of archOrder(upper)) {
      if (teeth.get(n)?.condition === "BRIDGE") run.push(n);
      else {
        if (run.length > 1) runs.push(run);
        run = [];
      }
    }
    if (run.length > 1) runs.push(run);

    return runs.map((r) => {
      const pts = r.map((n) => {
        const p = layout.get(n)!;
        const { hz } = crownExtent(p.spec, 0.45);
        return new THREE.Vector3(0, p.spec.crownHeight * 0.45, hz + 0.7).applyQuaternion(p.quaternion).add(p.position);
      });
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 12, 0.38, 8, false);
    });
  }, [layout, teeth, upper]);

  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);

  return (
    <>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g} material={materials.bridgeBar} raycast={() => null} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

const TAN_HALF_FOV = Math.tan((16 * Math.PI) / 180); // camera fov is 32° vertical

/** Distance at which a width×height region (mm) around the target just fills the canvas. */
function fitDistance(width: number, height: number, aspect: number) {
  // 1.1 = breathing room around the framed region.
  return 1.1 * Math.max(60, height / 2 / TAN_HALF_FOV, width / 2 / (TAN_HALF_FOV * aspect));
}

/** What each jaw selection frames: the crowns plus the gums, measured from the loaded model. */
export type DentitionFrames = Record<JawView, THREE.Box3>;

function dentitionFrames(source: AnatomySource): DentitionFrames {
  const frames: DentitionFrames = { full: new THREE.Box3(), upper: new THREE.Box3(), lower: new THREE.Box3() };
  const r = new THREE.Vector3(5, 6, 5);
  for (const p of source.layout.values()) {
    const crown = new THREE.Box3(p.crownCenter.clone().sub(r), p.crownCenter.clone().add(r));
    frames.full.union(crown);
    frames[p.upper ? "upper" : "lower"].union(crown);
  }
  for (const [jaw, part] of [["upper", source.gums.upper], ["lower", source.gums.lower]] as const) {
    if (!part) continue;
    part.geometry.computeBoundingBox();
    // Only the gum near the teeth: a deep schematic gum body shouldn't shrink the view.
    const box = part.geometry.boundingBox!.clone();
    if (jaw === "upper") box.max.y = Math.min(box.max.y, frames.upper.max.y + 10);
    else box.min.y = Math.max(box.min.y, frames.lower.min.y - 10);
    frames.full.union(box);
    frames[jaw].union(box);
  }
  return frames;
}

function presetPose(preset: CameraPreset, jaw: JawView, aspect: number, frames: DentitionFrames) {
  const box = frames[jaw];
  const t = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  switch (preset) {
    case "front": {
      // Facing the open mouth from just above the bite: upper labial faces and the lower
      // occlusal table are both readable.
      const d = fitDistance(size.x, size.y + size.z * 0.15, aspect);
      return { pos: new THREE.Vector3(0, t.y + d * 0.08, t.z + d), target: t };
    }
    case "left":
    case "right": {
      // Side views see the arch's full depth plus the far side's curve: allow extra room.
      const d = fitDistance(size.z * 1.25, size.y * 1.2, aspect);
      const side = preset === "left" ? 1 : -1;
      return { pos: new THREE.Vector3(side * d * 0.97, t.y + d * 0.08, t.z + d * 0.18), target: t };
    }
    case "occlusal": {
      const fromBelow = jaw === "upper";
      const d = fitDistance(size.x, size.z, aspect);
      return { pos: new THREE.Vector3(0, t.y + (fromBelow ? -d : d), t.z + d * 0.12), target: t };
    }
  }
}

/**
 * Looks at one tooth from its buccal side, slightly from the occlusal. `span` is the
 * width (mm) to keep in frame: one tooth with its root, or it and its neighbours.
 */
function focusPose(p: ToothPlacement, span: number, aspect: number) {
  const outward = new THREE.Vector3(0, 0, 1).applyQuaternion(p.quaternion);
  const occlusal = new THREE.Vector3(0, p.upper ? -1 : 1, 0);
  const dir = outward.multiplyScalar(0.9).add(occlusal.multiplyScalar(0.35)).normalize();
  // Aim a little rootwards of the crown so a see-through root stays in frame.
  const target = p.crownCenter.clone().add(new THREE.Vector3(0, p.upper ? 2 : -2, 0));
  const distance = fitDistance(span, p.spec.crownHeight + p.spec.rootLength + 6, aspect) / 1.1;
  return { pos: target.clone().addScaledVector(dir, Math.max(distance, 45)), target };
}

function CameraRig({
  camera,
  jaw,
  focusTooth,
  focusSpan,
  dragMode,
  controlsRef: ref,
  frames,
}: {
  camera: DentalSceneProps["camera"];
  jaw: JawView;
  focusTooth: ToothPlacement | null;
  focusSpan: number;
  dragMode: DragMode;
  controlsRef: RefObject<CameraControls | null>;
  frames: DentitionFrames | null;
}) {
  const size = useThree((s) => s.size);
  const first = useRef(true);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);

  useEffect(() => {
    const controls = ref.current;
    if (!controls) return;
    const aspect = size.width / Math.max(size.height, 1);
    const pose =
      camera.preset === "focus"
        ? focusTooth && focusPose(focusTooth, focusSpan, aspect)
        : frames && presetPose(camera.preset, jaw, aspect, frames);
    if (!pose) return;
    const { pos, target } = pose;
    controls.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, !first.current && !reducedMotion);
    first.current = false;
    // Size is read but deliberately not a dependency: resizing shouldn't snap the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.nonce, camera.preset, jaw, frames]);

  useEffect(() => {
    const controls = ref.current;
    if (!controls) return;
    const { ACTION } = CameraControlsImpl;
    controls.mouseButtons.left = dragMode === "pan" ? ACTION.TRUCK : ACTION.ROTATE;
    controls.touches.one = dragMode === "pan" ? ACTION.TOUCH_TRUCK : ACTION.TOUCH_ROTATE;
  }, [dragMode, ref]);

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={30}
      maxDistance={320}
      smoothTime={reducedMotion ? 0 : 0.28}
      draggingSmoothTime={reducedMotion ? 0 : 0.08}
      dollyToCursor
    />
  );
}

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

type LabelAnchor = { toothNumber: number; upper: boolean; position: THREE.Vector3; normal: THREE.Vector3 };

function labelAnchors(layout: Map<number, ToothPlacement>): LabelAnchor[] {
  return [...layout.values()].map((p) => {
    const { hz } = crownExtent(p.spec, 0.55);
    return {
      toothNumber: p.toothNumber,
      upper: p.upper,
      position: new THREE.Vector3(0, p.spec.crownHeight * 0.45, hz + 5).applyQuaternion(p.quaternion).add(p.position),
      normal: new THREE.Vector3(0, 0, 1).applyQuaternion(p.quaternion),
    };
  });
}

/**
 * Projects tooth-number pills (plain DOM, outside the canvas) onto the model each
 * frame and fades out labels on the far side of the arch so they don't pile up.
 */
function LabelProjector({
  anchors,
  elements,
  positions,
  pinned,
  version,
}: {
  anchors: LabelAnchor[];
  elements: RefObject<Map<number, HTMLDivElement>>;
  positions: RefObject<Map<number, { x: number; y: number }>>;
  pinned: (number | null)[];
  version: string;
}) {
  // Screen positions of the labels drawn this frame, read by the screenshot capture.
  const invalidate = useThree((s) => s.invalidate);
  const scratch = useMemo(() => ({ v: new THREE.Vector3(), toCam: new THREE.Vector3() }), []);

  // Labels mounting/unmounting doesn't touch the 3D scene, so ask for a frame.
  useEffect(() => invalidate(), [version, invalidate]);

  useFrame(({ camera, size }) => {
    const { v, toCam } = scratch;
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const candidates: { el: HTMLDivElement; x: number; y: number; w: number; h: number; rank: number }[] = [];
    const hidden: HTMLDivElement[] = [];

    for (const a of anchors) {
      const el = elements.current.get(a.toothNumber);
      if (!el) continue;
      v.copy(a.position).project(camera);
      toCam.subVectors(camera.position, a.position).normalize();
      const facing = a.normal.dot(toCam);
      const pin = pinned.includes(a.toothNumber);
      // Labels on the far (lingual-facing) side of the arch sit behind teeth — drop them.
      if (v.z > 1 || (!pin && facing < -0.45)) {
        hidden.push(el);
        continue;
      }
      // Measure before any style writes so layout is computed once per frame.
      candidates.push({
        el,
        x: ((v.x + 1) / 2) * size.width,
        y: ((1 - v.y) / 2) * size.height,
        w: el.offsetWidth || 26,
        h: el.offsetHeight || 16,
        rank: pin ? 10 : facing - v.z,
      });
    }

    // Greedy collision culling: best-facing / nearest labels claim space first.
    candidates.sort((p, q) => q.rank - p.rank);
    for (const el of hidden) el.style.visibility = "hidden";
    positions.current.clear();
    for (const c of candidates) {
      const { w, h } = c;
      const hit = placed.some((r) => Math.abs(r.x - c.x) < (r.w + w) / 2 + 2 && Math.abs(r.y - c.y) < (r.h + h) / 2 + 1);
      c.el.style.transform = `translate(${c.x}px, ${c.y}px) translate(-50%, -50%)`;
      if (hit && c.rank < 10) {
        c.el.style.visibility = "hidden";
      } else {
        c.el.style.visibility = "visible";
        placed.push({ x: c.x, y: c.y, w, h });
        positions.current.set(Number(c.el.dataset.tooth), { x: c.x, y: c.y });
      }
    }
  });

  return null;
}

function ToothLabel({
  tooth,
  hovered,
  selected,
  register,
}: {
  tooth: SceneTooth;
  hovered: boolean;
  selected: boolean;
  register: (el: HTMLDivElement | null) => void;
}) {
  const { toothNumber: n, condition } = tooth;
  const meta = CONDITION_META[condition];
  const plain = condition === "HEALTHY" || condition === "MISSING";
  const expanded = hovered || selected;
  return (
    <div
      ref={register}
      data-tooth={n}
      className={cn("absolute top-0 left-0", tooth.dimmed && !expanded && "opacity-35")}
      style={{ visibility: "hidden", zIndex: expanded ? 2 : 1 }}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-semibold whitespace-nowrap shadow-sm select-none",
          expanded && "px-2 py-1 text-[11px]",
          selected && "ring-primary ring-offset-background ring-2 ring-offset-1"
        )}
        style={{
          background: plain ? "var(--background)" : meta.color,
          color: plain ? "var(--foreground)" : meta.textColor,
          borderStyle: condition === "MISSING" ? "dashed" : "solid",
          borderColor: "color-mix(in oklab, var(--foreground) 18%, transparent)",
        }}
      >
        <span className="tabular-nums">{n}</span>
        {expanded && (
          <span className="font-medium opacity-90">
            {toothName(n).replace(/^(Upper|Lower) (Left|Right) /, "")} · {meta.label}
          </span>
        )}
      </div>
    </div>
  );
}

/** Translucent copy of an asset's own gum/bone material, for the see-through modes. */
function useGlassVariant(material: THREE.Material | undefined) {
  const glass = useMemo(() => {
    if (!material) return null;
    const m = material.clone();
    m.transparent = true;
    m.opacity = 0.3;
    m.depthWrite = false;
    m.side = THREE.DoubleSide;
    return m;
  }, [material]);
  useEffect(() => () => glass?.dispose(), [glass]);
  return glass;
}

function Dentition({
  source,
  teeth,
  selected,
  hovered,
  onHover,
  onSelect,
  jaw,
  gumMode,
  layers,
  sectioned,
  shown,
  lowPower,
}: {
  source: AnatomySource;
  teeth: Map<number, SceneTooth>;
  selected: number | null;
  hovered: number | null;
  onHover: (update: (cur: number | null) => number | null) => void;
  onSelect: (n: number) => void;
  jaw: JawView;
  gumMode: GumMode;
  layers: Record<AnatomyLayer, boolean>;
  /** Tooth shown in cross-section, if any. */
  sectioned: number | null;
  shown: Set<number> | null;
  lowPower: boolean;
}) {
  const { layout } = source;
  const materials = useMemo(() => {
    const m = createMaterials();
    if (lowPower) Object.values(m).forEach(simplifyForLowPower);
    return m;
  }, [lowPower]);
  useEffect(() => {
    if (!lowPower) return;
    // The model's own materials too (shared with the loader cache; the device won't change).
    for (const t of source.teeth.values()) {
      for (const part of [t.enamel, ...t.dentin, t.pulp, t.nerve]) if (part?.material) simplifyForLowPower(part.material);
    }
    for (const part of [source.gums.upper, source.gums.lower]) if (part?.material) simplifyForLowPower(part.material);
  }, [lowPower, source]);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);
  const geo = useMemo(() => new GeometryCache(layout), [layout]);
  useEffect(() => () => geo.dispose(), [geo]);
  const section = useMemo(() => new SectionKit(), []);
  useEffect(() => () => section.dispose(), [section]);
  const sectionPlacement = sectioned !== null ? layout.get(sectioned) : undefined;
  if (sectionPlacement) section.aim(sectionPlacement);
  useCursor(hovered !== null);

  const gumGlassUpper = useGlassVariant(source.gums.upper?.material);
  const gumGlassLower = useGlassVariant(source.gums.lower?.material);
  const boneGlassUpper = useGlassVariant(source.bone.upper?.material);
  const boneGlassLower = useGlassVariant(source.bone.lower?.material);

  // While isolating, only the isolated teeth's jaw is drawn.
  const isolatedUpper = shown ? Math.floor([...shown][0] / 10) <= 2 : null;
  const jawShown = (upper: boolean) =>
    (jaw === "full" || (jaw === "upper") === upper) && (isolatedUpper === null || isolatedUpper === upper);
  const visible = (p: ToothPlacement) => jawShown(p.upper) && (!shown || shown.has(p.toothNumber));
  // While the legend highlights a status, a tooth is isolated or sectioned, see-through gums let roots show.
  const highlighting = [...teeth.values()].some((t) => t.dimmed);
  // With dentin hidden only the pulps remain, and they sit below the gum line.
  const seeThrough =
    gumMode === "translucent" ||
    highlighting ||
    shown !== null ||
    sectioned !== null ||
    (source.available.dentin && !layers.dentin) ||
    // Gums cover the alveolar bone, so showing the jaw bone means seeing through them.
    (source.available.bone && layers.bone);
  const showGums = gumMode !== "hidden" && !(shown && shown.size === 1);
  // Bone goes see-through for isolation, sections and the legend highlight, so roots stay visible.
  const boneSeeThrough = highlighting || shown !== null || sectioned !== null;

  function gumMesh(part: LayerPart | undefined, glass: THREE.Material | null, name: string) {
    if (!part) return null;
    const material = seeThrough ? (glass ?? materials.gumGlass) : (part.material ?? materials.gum);
    return <mesh name={name} geometry={part.geometry} material={material} renderOrder={5} raycast={() => null} />;
  }

  return (
    <>
      {[...layout.values()].filter(visible).map((p) => {
        const tooth = teeth.get(p.toothNumber);
        const anatomy = source.teeth.get(p.toothNumber);
        if (!tooth || !anatomy) return null;
        return (
          <ToothModel
            key={p.toothNumber}
            placement={p}
            anatomy={anatomy}
            tooth={tooth}
            materials={materials}
            geo={geo}
            layers={layers}
            section={sectioned === p.toothNumber ? section : null}
            // A tooth shown on its own needs no selection marks over its anatomy.
            selected={selected === p.toothNumber && shown?.size !== 1}
            hovered={hovered === p.toothNumber && shown?.size !== 1}
            onHover={(n) => onHover((cur) => (n === null ? (cur === p.toothNumber ? null : cur) : n))}
            onSelect={onSelect}
          />
        );
      })}

      {!shown && jaw !== "lower" && <BridgeBars layout={layout} teeth={teeth} materials={materials} upper />}
      {!shown && jaw !== "upper" && <BridgeBars layout={layout} teeth={teeth} materials={materials} upper={false} />}

      {showGums && jawShown(true) && gumMesh(source.gums.upper, gumGlassUpper, "gingiva_upper")}
      {showGums && jawShown(false) && gumMesh(source.gums.lower, gumGlassLower, "gingiva_lower")}

      {/* Jaw bone only exists in supplied anatomical models; it is never synthesised. */}
      {layers.bone && !(shown && shown.size === 1) && jawShown(true) && source.bone.upper && (
        <mesh
          name="maxilla"
          geometry={source.bone.upper.geometry}
          material={boneSeeThrough ? (boneGlassUpper ?? materials.gumGlass) : (source.bone.upper.material ?? materials.root)}
          renderOrder={4}
          raycast={() => null}
        />
      )}
      {layers.bone && !(shown && shown.size === 1) && jawShown(false) && source.bone.lower && (
        <mesh
          name="mandible"
          geometry={source.bone.lower.geometry}
          material={boneSeeThrough ? (boneGlassLower ?? materials.gumGlass) : (source.bone.lower.material ?? materials.root)}
          renderOrder={4}
          raycast={() => null}
        />
      )}
    </>
  );
}

/** The selected tooth plus `reach` neighbours on each side within its own arch. */
function neighbourSet(toothNumber: number, reach: number) {
  const order = archOrder(Math.floor(toothNumber / 10) <= 2);
  const i = order.indexOf(toothNumber);
  return new Set(order.slice(Math.max(0, i - reach), i + reach + 1));
}

/** Pill colours for the screenshot (CSS variables can't be read by a 2D canvas). */
function pillColours(condition: ToothConditionKey) {
  const meta = CONDITION_META[condition];
  return condition === "HEALTHY" || condition === "MISSING"
    ? { bg: "#ffffff", fg: "#102b4e" }
    : { bg: meta.color, fg: meta.textColor };
}

/** Registers the screenshot function, which needs the renderer, scene and camera. */
const THUMB = { width: 240, height: 150 };

function CaptureBridge({
  onApi,
  labels,
  teeth,
  controls,
  frames,
}: {
  onApi?: (api: DentalSceneApi | null) => void;
  labels: RefObject<Map<number, { x: number; y: number }>>;
  teeth: Map<number, SceneTooth>;
  controls: RefObject<CameraControls | null>;
  frames: DentitionFrames | null;
}) {
  const { gl, scene, camera, size, invalidate } = useThree();
  const teethRef = useRef(teeth);
  useEffect(() => {
    teethRef.current = teeth;
  }, [teeth]);

  useEffect(() => {
    if (!onApi) return;
    onApi({
      capture() {
        // Render now so the drawing buffer is populated in this same task.
        gl.render(scene, camera);
        const src = gl.domElement;
        const ratio = src.width / size.width;
        const out = document.createElement("canvas");
        out.width = src.width;
        out.height = src.height;
        const ctx = out.getContext("2d")!;
        const bg = ctx.createRadialGradient(out.width / 2, out.height * 0.35, 0, out.width / 2, out.height * 0.35, out.width * 0.7);
        bg.addColorStop(0, "#ffffff");
        bg.addColorStop(1, "#e3ecf5");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(src, 0, 0);

        ctx.font = `600 ${11 * ratio}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const [n, { x, y }] of labels.current) {
          const tooth = teethRef.current.get(n);
          if (!tooth) continue;
          const { bg: fill, fg } = pillColours(tooth.condition);
          const w = ctx.measureText(String(n)).width + 12 * ratio;
          const h = 17 * ratio;
          ctx.beginPath();
          ctx.roundRect(x * ratio - w / 2, y * ratio - h / 2, w, h, h / 2);
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.strokeStyle = "rgba(16,43,78,0.2)";
          ctx.lineWidth = ratio;
          ctx.stroke();
          ctx.fillStyle = fg;
          ctx.fillText(String(n), x * ratio, y * ratio + 0.5 * ratio);
        }
        return out.toDataURL("image/png");
      },
      zoom(direction) {
        const c = controls.current;
        if (c) void c.dolly(direction * c.distance * 0.22, true);
      },
      views() {
        if (!frames) return {};
        const aspect = size.width / Math.max(size.height, 1);
        const cam = new THREE.PerspectiveCamera(32, aspect, 1, 2000);
        const out = document.createElement("canvas");
        out.width = THUMB.width;
        out.height = THUMB.height;
        const ctx = out.getContext("2d")!;
        // Crop the centre of the canvas to the thumbnail's aspect ratio.
        const src = gl.domElement;
        const cropW = Math.min(src.width, (src.height * THUMB.width) / THUMB.height);
        const cropH = (cropW * THUMB.height) / THUMB.width;
        const result: Partial<Record<CameraPreset, string>> = {};
        const upper = scene.children.length ? findUpperObjects(scene) : [];
        for (const preset of ["front", "left", "right", "occlusal"] as const) {
          const occlusal = preset === "occlusal";
          const { pos, target } = presetPose(preset, occlusal ? "lower" : "full", aspect, frames);
          cam.position.copy(pos);
          cam.lookAt(target);
          // Looking down on both jaws only shows the upper gum: hide the upper arch for that view.
          if (occlusal) upper.forEach((o) => (o.visible = false));
          gl.render(scene, cam);
          if (occlusal) upper.forEach((o) => (o.visible = true));
          ctx.clearRect(0, 0, out.width, out.height);
          ctx.drawImage(src, (src.width - cropW) / 2, (src.height - cropH) / 2, cropW, cropH, 0, 0, out.width, out.height);
          result[preset] = out.toDataURL("image/png");
        }
        invalidate();
        return result;
      },
    });
    return () => onApi(null);
  }, [onApi, gl, scene, camera, size, labels, controls, invalidate, frames]);

  return null;
}

const EMPTY_LAYOUT = new Map<number, ToothPlacement>();

/** Phones and tablets: lower pixel ratio and environment resolution keep frames smooth. */
function isLowPowerDevice() {
  return window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
}

/** Upper teeth, upper gingiva and maxilla, found by their node names. */
function findUpperObjects(scene: THREE.Object3D) {
  const found: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (/^tooth_[12]\d$/.test(o.name) || o.name === "gingiva_upper" || o.name === "maxilla") found.push(o);
  });
  return found;
}

export default function DentalScene(props: DentalSceneProps) {
  const { modelUrl, onSourceChange } = props;
  const [asset, setAsset] = useState<{ url: string; source: AnatomySource } | null>(null);
  const [failed, setFailed] = useState<{ url: string; reason: string } | null>(null);
  const useAsset = Boolean(modelUrl) && failed?.url !== modelUrl;
  // The schematic model is built only when no supplied model is in use (or it failed).
  const procedural = useMemo(() => (useAsset ? null : proceduralAnatomy()), [useAsset]);
  useEffect(() => () => procedural?.dispose(), [procedural]);
  const source = procedural ?? (asset && asset.url === modelUrl ? asset.source : null);

  useEffect(() => {
    if (!onSourceChange) return;
    if (!source) return onSourceChange({ status: "loading" });
    onSourceChange({
      status: "ready",
      kind: source.kind,
      description: source.description,
      credit: source.credit,
      available: source.available,
      warnings: source.warnings,
      fallbackReason: failed && failed.url === modelUrl ? failed.reason : undefined,
    });
  }, [source, failed, modelUrl, onSourceChange]);

  const layout = source?.layout ?? EMPTY_LAYOUT;
  const frames = useMemo(() => (source ? dentitionFrames(source) : null), [source]);
  const anchors = useMemo(() => labelAnchors(layout), [layout]);
  const layers = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(props.layers).map(([k, on]) => [k, on && (source?.available[k as AnatomyLayer] ?? false)])
      ) as Record<AnatomyLayer, boolean>,
    [props.layers, source]
  );
  // With the status layer off, present teeth render as natural anatomy; absent ones stay absent.
  const byNumber = useMemo(
    () =>
      new Map(
        props.teeth.map((t) => [
          t.toothNumber,
          props.showStatus || t.condition === "MISSING" ? t : { ...t, condition: "HEALTHY" as const, surfaces: [] },
        ])
      ),
    [props.teeth, props.showStatus]
  );
  const shown = useMemo(
    () =>
      props.isolate === "all" || props.selected === null
        ? null
        : neighbourSet(props.selected, props.isolate === "tooth" ? 0 : 2),
    [props.isolate, props.selected]
  );
  const [hovered, setHovered] = useState<number | null>(null);
  const labelEls = useRef(new Map<number, HTMLDivElement>());
  const labelPositions = useRef(new Map<number, { x: number; y: number }>());
  const controlsRef = useRef<CameraControls>(null);
  // This component only renders in the browser (loaded with ssr: false).
  const [lowPower] = useState(isLowPowerDevice);
  const contextLost = useRef(props.onContextLost);
  useEffect(() => {
    contextLost.current = props.onContextLost;
  });

  const labelled = anchors.filter((a) => {
    if (props.jaw !== "full" && (props.jaw === "upper") !== a.upper) return false;
    if (shown && !shown.has(a.toothNumber)) return false;
    if (shown?.size === 1) return false;
    if (!byNumber.has(a.toothNumber)) return false;
    return props.showLabels || a.toothNumber === hovered || a.toothNumber === props.selected;
  });

  return (
    <div className="absolute inset-0">
      <Canvas
        frameloop="demand"
        dpr={lowPower ? [1, 1.5] : [1, 2]}
        camera={{ fov: 32, near: 1, far: 2000, position: [0, 15, 126] }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          // Cross-sections clip individual materials.
          gl.localClippingEnabled = true;
          gl.domElement.addEventListener("webglcontextlost", (event) => {
            event.preventDefault();
            contextLost.current?.();
          });
          // Neutral tone mapping keeps enamel and gingiva close to their real hue (ACES shifts them warm).
          gl.toneMapping = THREE.NeutralToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
        onPointerMissed={() => setHovered(null)}
      >
        {/* Soft clinical studio: broad key from above-front, gentle fills, a rim from behind. */}
        <hemisphereLight args={["#ffffff", "#e8dcd4", 0.55]} />
        <directionalLight position={[40, 110, 140]} intensity={1.35} />
        <directionalLight position={[-110, 20, 80]} intensity={0.45} color="#f4f7ff" />
        <directionalLight position={[110, -30, 70]} intensity={0.35} />
        <directionalLight position={[0, 60, -160]} intensity={0.5} />

        <Environment resolution={lowPower ? 128 : 256} frames={1} environmentIntensity={0.55}>
          {/* Neutral studio backdrop so metals (crowns, implants) reflect light grey, not black. */}
          <color attach="background" args={["#c3c8d0"]} />
          <Lightformer intensity={2} position={[0, 6, 10]} scale={[16, 6, 1]} />
          <Lightformer intensity={0.9} position={[-10, 2, 4]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
          <Lightformer intensity={0.9} position={[10, 2, 4]} rotation-y={-Math.PI / 2} scale={[10, 3, 1]} />
          <Lightformer intensity={0.6} position={[0, -8, 0]} rotation-x={-Math.PI / 2} scale={[20, 20, 1]} color="#fff1ea" />
        </Environment>

        {modelUrl && useAsset && (
          <AssetBoundary
            key={modelUrl}
            onError={(reason) => {
              console.error("Dental model failed to load; using the schematic model.", reason);
              setFailed({ url: modelUrl, reason });
            }}
          >
            <Suspense fallback={null}>
              <AssetAnatomyLoader url={modelUrl} onLoaded={(source) => setAsset({ url: modelUrl, source })} />
            </Suspense>
          </AssetBoundary>
        )}
        {source && (
          <Dentition
            source={source}
            teeth={byNumber}
            selected={props.selected}
            hovered={hovered}
            onHover={setHovered}
            onSelect={props.onSelect}
            jaw={props.jaw}
            gumMode={props.gumMode}
            layers={layers}
            sectioned={props.section ? props.selected : null}
            shown={shown}
            lowPower={lowPower}
          />
        )}
        <CameraRig
          camera={props.camera}
          jaw={props.jaw}
          focusTooth={props.selected !== null ? (layout.get(props.selected) ?? null) : null}
          focusSpan={props.isolate === "neighbors" ? 44 : 22}
          dragMode={props.dragMode ?? "rotate"}
          controlsRef={controlsRef}
          frames={frames}
        />
        <LabelProjector
          anchors={anchors}
          elements={labelEls}
          positions={labelPositions}
          pinned={[hovered, props.selected]}
          version={`${labelled.map((a) => a.toothNumber).join()}|${hovered}|${props.selected}`}
        />
        <CaptureBridge onApi={props.onApi} labels={labelPositions} teeth={byNumber} controls={controlsRef} frames={frames} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {labelled.map((a) => (
          <ToothLabel
            key={a.toothNumber}
            tooth={byNumber.get(a.toothNumber)!}
            hovered={hovered === a.toothNumber}
            selected={props.selected === a.toothNumber}
            register={(el) => {
              if (el) labelEls.current.set(a.toothNumber, el);
              else labelEls.current.delete(a.toothNumber);
            }}
          />
        ))}
      </div>
    </div>
  );
}
