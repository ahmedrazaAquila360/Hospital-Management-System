"use client";

import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import {
  AlertTriangle,
  Box,
  Camera,
  ChevronDown,
  Crosshair,
  Hand,
  Hash,
  Layers,
  Maximize2,
  Rotate3d,
  RotateCcw,
  Scissors,
  Tag,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CONDITION_META, LOWER_LEFT, LOWER_RIGHT, UPPER_LEFT, UPPER_RIGHT, toothName } from "@/lib/dental";
import { ToothIcon } from "./tooth-icon";
import { DentalChartFallback } from "./dental-chart-fallback";
import { cn } from "@/lib/utils";
import type { AnatomyLayer } from "./three/anatomy";
import type {
  CameraPreset,
  DentalSceneApi,
  DragMode,
  GumMode,
  IsolateMode,
  JawView,
  SceneTooth,
  SourceInfo,
} from "./three/dental-scene";

// Anatomical model (BodyParts3D-derived, see public/models/LICENSE-dentition.txt). Read at
// build time: set NEXT_PUBLIC_DENTAL_MODEL_URL to use another model, or to "schematic" for
// the built-in procedural one.
const MODEL_URL =
  process.env.NEXT_PUBLIC_DENTAL_MODEL_URL === "schematic"
    ? null
    : process.env.NEXT_PUBLIC_DENTAL_MODEL_URL || "/models/dentition-bp3d.glb";

// Lifelike "game-style" mouth (textured crowns and gums, no roots or inner layers), built by
// scripts/build-realistic-mouth.mts. See public/models/LICENSE-mouth-realistic.txt.
const REALISTIC_MODEL_URL = process.env.NEXT_PUBLIC_DENTAL_REALISTIC_MODEL_URL || "/models/mouth-realistic.glb";

type ModelStyle = "anatomical" | "realistic";
const MODEL_STYLES: { value: ModelStyle; label: string; hint: string; url: string | null }[] = [
  { value: "anatomical", label: "Anatomical", hint: "Teeth with roots, inner layers and jaw bone", url: MODEL_URL },
  { value: "realistic", label: "Realistic mouth", hint: "Lifelike teeth and gums — crowns only", url: REALISTIC_MODEL_URL },
];

// The chosen model is a per-browser preference: remembered when storage is available,
// otherwise kept for this visit only.
const MODEL_STYLE_KEY = "dentalhub.chart3d.model";
const modelStyleListeners = new Set<() => void>();
let modelStyle: ModelStyle | null = null;
function readModelStyle(): ModelStyle {
  if (modelStyle === null) {
    try {
      modelStyle = window.localStorage.getItem(MODEL_STYLE_KEY) === "realistic" ? "realistic" : "anatomical";
    } catch {
      modelStyle = "anatomical";
    }
  }
  return modelStyle;
}
function writeModelStyle(next: ModelStyle) {
  modelStyle = next;
  try {
    window.localStorage.setItem(MODEL_STYLE_KEY, next);
  } catch {
    // storage blocked: the choice still applies until the page is closed
  }
  modelStyleListeners.forEach((l) => l());
}
function subscribeModelStyle(listener: () => void) {
  modelStyleListeners.add(listener);
  return () => {
    modelStyleListeners.delete(listener);
  };
}

function SceneLoading() {
  return (
    <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm">
      <Spinner className="size-5" />
      Loading 3D model…
    </div>
  );
}

// three.js + R3F only download when the 3D view is opened.
const DentalScene = dynamic(() => import("./three/dental-scene"), { ssr: false, loading: SceneLoading });

class SceneErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * What 3D the browser can do. "software" means WebGL only works without the GPU
 * (blocklisted driver, or acceleration turned off) — usable but slow, so the image view
 * is the default there. The probe contexts are released straight away so they don't
 * count against the browser's WebGL context limit.
 */
type GraphicsTier = "hardware" | "software" | "none";

function probeWebGL(attributes: WebGLContextAttributes) {
  for (const kind of ["webgl2", "webgl", "experimental-webgl"] as const) {
    try {
      const gl = document.createElement("canvas").getContext(kind, attributes) as WebGLRenderingContext | null;
      if (gl) {
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        return true;
      }
    } catch {
      // try the next kind
    }
  }
  return false;
}

let graphicsTier: GraphicsTier | null = null;
function detectGraphics(): GraphicsTier {
  // `?graphics=none|software` reproduces what users without GPU 3D see (testing, support).
  const forced = new URLSearchParams(window.location.search).get("graphics");
  if (forced === "none" || forced === "software") return forced;
  graphicsTier ??= probeWebGL({ failIfMajorPerformanceCaveat: true })
    ? "hardware"
    : probeWebGL({})
      ? "software"
      : "none";
  return graphicsTier;
}

const FALLBACK_COPY: Record<"software" | "none" | "crashed" | "lost", { reason: string; hint?: string }> = {
  software: {
    reason: "This browser is drawing 3D without the graphics card, so the interactive model would be slow.",
    hint: "Turning on hardware acceleration in the browser settings enables the interactive view.",
  },
  none: {
    reason: "3D graphics (WebGL) are turned off or blocked in this browser.",
    // Chrome also switches the GPU off by itself after repeated graphics crashes, with the
    // setting still on: only a full restart brings it back.
    hint: "Turn on hardware acceleration in the browser settings (Chrome: Settings › System), then restart the browser. If it is already on, fully restart the browser (in Chrome, open chrome://restart): after graphics errors Chrome turns 3D off until it restarts.",
  },
  crashed: { reason: "The interactive 3D view stopped working on this device." },
  lost: { reason: "The graphics card reset and the interactive 3D view was paused." },
};
const noopSubscribe = () => () => {};

const JAW_OPTIONS: { value: JawView; label: string }[] = [
  { value: "full", label: "Full mouth" },
  { value: "upper", label: "Upper" },
  { value: "lower", label: "Lower" },
];

const PRESETS: { value: CameraPreset; label: string }[] = [
  { value: "front", label: "Front" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "occlusal", label: "Occlusal" },
];

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="bg-background/85 flex rounded-lg border p-0.5 shadow-sm backdrop-blur">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === o.value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const GUM_OPTIONS: { value: GumMode; label: string; hint: string }[] = [
  { value: "solid", label: "Solid gums", hint: "Natural view" },
  { value: "translucent", label: "Translucent gums", hint: "Roots visible through the gingiva" },
  { value: "hidden", label: "Hide gums", hint: "Crowns and roots only" },
];

const LAYER_OPTIONS: { value: AnatomyLayer; label: string; hint: string }[] = [
  { value: "enamel", label: "Enamel", hint: "Outer crown layer, with recorded restorations" },
  { value: "dentin", label: "Dentin & roots", hint: "Seen when enamel is hidden or in section" },
  { value: "pulp", label: "Pulp", hint: "Chamber and canals — visible in section or with dentin hidden" },
  { value: "nerve", label: "Nerves & vessels", hint: "Neurovascular bundle inside the pulp" },
  { value: "bone", label: "Jaw bone", hint: "Maxilla and mandible" },
];

const ISOLATE_OPTIONS: { value: IsolateMode; label: string }[] = [
  { value: "all", label: "Full arch" },
  { value: "neighbors", label: "± 2 teeth" },
  { value: "tooth", label: "Tooth only" },
];

function RailButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      aria-label={label}
      className={cn(
        // Icon-only on phones so the model keeps the width; labelled from sm up.
        "flex w-9 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors sm:w-14 [&_svg]:size-4",
        "[&>span]:hidden sm:[&>span]:block",
        pressed ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

const ARCH_ROWS = { upper: [...UPPER_RIGHT, ...UPPER_LEFT], lower: [...[...LOWER_RIGHT].reverse(), ...LOWER_LEFT] };

/**
 * Occlusal-view map of both arches (patient's right on the left): one dot per tooth
 * in its recorded status colour. Clicking a dot selects that tooth everywhere.
 */
function ArchMinimap({
  teeth,
  selected,
  onSelect,
}: {
  teeth: SceneTooth[];
  selected: number | null;
  onSelect: (n: number) => void;
}) {
  const byNumber = new Map(teeth.map((t) => [t.toothNumber, t]));
  const cx = 52;
  const cy = 62;
  const dot = (n: number, i: number, upper: boolean) => {
    // Upper arch over the top half of an oval, lower arch under the bottom half.
    const a = Math.PI * (1 - (i + 0.5) / 16);
    // Rounded so server and browser render identical attributes.
    const x = Math.round((cx + Math.cos(a) * 38) * 100) / 100;
    const y = Math.round((cy + (upper ? -1 : 1) * Math.sin(a) * 46) * 100) / 100;
    const tooth = byNumber.get(n);
    if (!tooth) return null;
    const plain = tooth.condition === "HEALTHY" || tooth.condition === "MISSING";
    return (
      <circle
        key={n}
        cx={x}
        cy={y}
        r={selected === n ? 4.6 : 3.6}
        role="button"
        aria-label={`Tooth ${n}, ${CONDITION_META[tooth.condition].label}`}
        onClick={() => onSelect(n)}
        className="cursor-pointer"
        fill={plain ? "#ffffff" : CONDITION_META[tooth.condition].color}
        stroke={selected === n ? "var(--primary)" : "#94a3b8"}
        strokeWidth={selected === n ? 2 : 1}
        strokeDasharray={tooth.condition === "MISSING" ? "2 1.5" : undefined}
      >
        <title>{`${n} · ${CONDITION_META[tooth.condition].label}`}</title>
      </circle>
    );
  };
  return (
    <div className="bg-background/90 rounded-xl border p-1.5 shadow-sm backdrop-blur">
      <svg viewBox="0 0 104 124" className="h-28 w-24" aria-label="Arch map">
        <text x={cx} y={8} textAnchor="middle" className="fill-muted-foreground text-[8px] font-semibold">
          Upper
        </text>
        <text x={cx} y={121} textAnchor="middle" className="fill-muted-foreground text-[8px] font-semibold">
          Lower
        </text>
        <text x={4} y={cy + 3} className="fill-muted-foreground text-[8px] font-semibold">
          R
        </text>
        <text x={95} y={cy + 3} className="fill-muted-foreground text-[8px] font-semibold">
          L
        </text>
        {ARCH_ROWS.upper.map((n, i) => dot(n, i, true))}
        {ARCH_ROWS.lower.map((n, i) => dot(n, i, false))}
      </svg>
    </div>
  );
}

function ViewTile({
  label,
  image,
  icon,
  active,
  disabled,
  title,
  onClick,
}: {
  label: string;
  image?: string;
  icon?: ReactNode;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      title={title ?? label}
      onClick={onClick}
      className={cn(
        "group flex w-28 shrink-0 flex-col items-center gap-1.5 rounded-xl border bg-white p-1.5 text-xs font-medium transition-all",
        "hover:border-primary/40 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:shadow-none",
        active ? "border-primary text-primary ring-primary/20 ring-2" : "text-foreground/80"
      )}
    >
      <span className="bg-pale flex h-16 w-full items-center justify-center overflow-hidden rounded-lg">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data: URL rendered from the live scene
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-primary/70 [&_svg]:size-7">{icon}</span>
        )}
      </span>
      {label}
    </button>
  );
}

function LayerSwitch({
  label,
  checked,
  disabled,
  hint,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  hint?: string;
  onChange: (on: boolean) => void;
}) {
  return (
    <label
      title={hint}
      className={cn("flex items-center gap-2.5 py-1 text-sm", disabled ? "text-muted-foreground cursor-not-allowed" : "cursor-pointer")}
    >
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} className="scale-90" />
      {label}
    </label>
  );
}

/**
 * The 3D model area. Like the 2D chart it is controlled by DentalChartViews, which
 * owns the teeth (with any unsaved preview applied), the selected tooth, the status
 * legend above and the tooth side panel. Everything here is view state only — it
 * never changes the clinical record.
 */
export function DentalChart3D({
  teeth,
  selected,
  onSelect,
  className,
  compact = false,
  legend,
  screenshotRef,
}: {
  teeth: SceneTooth[];
  selected: number | null;
  onSelect: (toothNumber: number) => void;
  /** Overrides the viewport height (presentation mode fills the screen). */
  className?: string;
  /** Patient presentation: no thumbnails, layer panel or screenshot. */
  compact?: boolean;
  /** Status legend floated in the viewport's left edge. */
  legend?: ReactNode;
  /** Lets the chart's quick-action bar trigger a screenshot. */
  screenshotRef?: RefObject<(() => void) | null>;
}) {
  const tier = useSyncExternalStore(noopSubscribe, detectGraphics, () => "hardware" as GraphicsTier);
  const style = useSyncExternalStore(subscribeModelStyle, readModelStyle, () => "anatomical" as ModelStyle);
  const model = MODEL_STYLES.find((m) => m.value === style) ?? MODEL_STYLES[0];
  // Why the image view is showing instead of the interactive one, if it is.
  const [fallback, setFallback] = useState<keyof typeof FALLBACK_COPY | null>(null);
  const [forceInteractive, setForceInteractive] = useState(false);
  const [sceneKey, setSceneKey] = useState(0);
  const autoFallback = tier === "hardware" || forceInteractive ? null : tier;
  const imageMode = fallback ?? autoFallback;
  const [jaw, setJaw] = useState<JawView>("full");
  const [camera, setCamera] = useState<{ preset: CameraPreset | "focus"; nonce: number }>({ preset: "front", nonce: 0 });
  const [lastPreset, setLastPreset] = useState<CameraPreset>("front");
  const [gumMode, setGumMode] = useState<GumMode>("solid");
  const [isolate, setIsolate] = useState<IsolateMode>("all");
  const [showLabels, setShowLabels] = useState(true);
  const [showStatus, setShowStatus] = useState(true);
  const [layers, setLayers] = useState<Record<AnatomyLayer, boolean>>({
    enamel: true,
    dentin: true,
    pulp: true,
    nerve: true,
    // Off by default, as in the clinical reference: teeth and gums stay the focus.
    bone: false,
  });
  const [section, setSection] = useState(false);
  const [dragMode, setDragMode] = useState<DragMode>("rotate");
  const [views, setViews] = useState<Partial<Record<CameraPreset, string>>>({});
  // Null until the 3D scene code itself has loaded (its own spinner covers that wait).
  const [sourceInfo, setSourceInfo] = useState<SourceInfo | null>(null);
  const api = useRef<DentalSceneApi | null>(null);
  const ready = sourceInfo?.status === "ready" ? sourceInfo : null;
  const onApi = useCallback((a: DentalSceneApi | null) => {
    api.current = a;
  }, []);

  // A tooth selected elsewhere (2D view, side panel) may sit in the hidden jaw — show both.
  // Deselecting leaves isolation, since there is nothing left to isolate.
  const [lastSelected, setLastSelected] = useState(selected);
  if (selected !== lastSelected) {
    setLastSelected(selected);
    if (selected === null) setSection(false);
    if (selected === null && isolate !== "all") {
      setIsolate("all");
      setCamera((c) => ({ preset: lastPreset, nonce: c.nonce + 1 }));
    } else if (selected !== null && jaw !== "full" && (jaw === "upper") !== Math.floor(selected / 10) <= 2) {
      setJaw("full");
      setCamera((c) => ({ preset: "front", nonce: c.nonce + 1 }));
    } else if (selected !== null && isolate !== "all") {
      setCamera((c) => ({ preset: "focus", nonce: c.nonce + 1 }));
    }
  }

  function aim(preset: CameraPreset | "focus") {
    if (preset !== "focus") setLastPreset(preset);
    setCamera((c) => ({ preset, nonce: c.nonce + 1 }));
  }

  function changeJaw(next: JawView) {
    setJaw(next);
    setIsolate("all");
    aim(next === "full" ? "front" : "occlusal");
  }

  function choosePreset(preset: CameraPreset) {
    // Looking straight down/up at both jaws only shows the upper gum, so pick a jaw.
    if (preset === "occlusal" && jaw === "full") {
      setJaw("lower");
    }
    setIsolate("all");
    aim(preset);
  }

  function changeIsolate(next: IsolateMode) {
    setIsolate(next);
    aim(next === "all" ? lastPreset : "focus");
  }

  function reset() {
    setJaw("full");
    setIsolate("all");
    setGumMode("solid");
    setSection(false);
    setLayers({ enamel: true, dentin: true, pulp: true, nerve: true, bone: false });
    aim("front");
  }

  function changeModel(next: ModelStyle) {
    if (next === style) return;
    writeModelStyle(next);
    // The other model may lack layers or teeth the current view relies on: start from the full mouth.
    setSection(false);
    setIsolate("all");
    setViews({});
    aim(lastPreset);
  }

  function toggleSection() {
    // The cut face looks at the buccal side, which is where Focus puts the camera.
    if (!section) aim("focus");
    setSection(!section);
  }

  function screenshot() {
    const url = api.current?.capture();
    if (!url) return;
    // File name carries no patient details — only the tooth (if any) and the date.
    const name = `dental-chart${selected !== null ? `-tooth-${selected}` : ""}-${format(new Date(), "yyyy-MM-dd-HHmm")}.png`;
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  }

  useEffect(() => {
    if (!screenshotRef) return;
    screenshotRef.current = screenshot;
    return () => {
      screenshotRef.current = null;
    };
  });

  // Thumbnails are rendered from the live scene (so they show this patient's statuses),
  // shortly after the model is ready or the chart changes, and only from the full-mouth view.
  const thumbsWanted = !compact && Boolean(ready) && isolate === "all" && !section;
  useEffect(() => {
    if (!thumbsWanted) return;
    const timer = window.setTimeout(() => {
      const next = api.current?.views();
      if (next) setViews(next);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [thumbsWanted, teeth, gumMode, layers, showStatus]);

  const presetActive = (p: CameraPreset) => camera.preset === p && isolate === "all" && !section;
  const isFrontView = !imageMode && camera.preset === "front" && jaw === "full" && isolate === "all" && !section;

  const advancedLayers = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-primary h-7 justify-start px-0 text-xs">
          <Layers className="size-3.5" /> Enamel, dentin & pulp…
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Anatomy layers</DropdownMenuLabel>
        {LAYER_OPTIONS.map((o) => {
          const available = Boolean(ready?.available[o.value]);
          // A model without inner layers has whole-tooth meshes on its enamel layer.
          const label = o.value === "enamel" && ready && !ready.available.dentin ? "Teeth (whole tooth)" : o.label;
          return (
            <DropdownMenuCheckboxItem
              key={o.value}
              checked={available && layers[o.value]}
              disabled={!available}
              onCheckedChange={(on) => setLayers((l) => ({ ...l, [o.value]: on }))}
              onSelect={(e) => e.preventDefault()}
              className="items-start"
            >
              <span className="flex flex-col">
                <span>{label}</span>
                <span className="text-muted-foreground text-xs">
                  {available ? o.hint : "Not in this model — needs an anatomical model with this layer"}
                </span>
              </span>
            </DropdownMenuCheckboxItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Gums</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={gumMode} onValueChange={(v) => setGumMode(v as GumMode)}>
          {GUM_OPTIONS.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value} className="flex-col items-start gap-0">
              <span>{o.label}</span>
              <span className="text-muted-foreground text-xs">{o.hint}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {ready && (
          <>
            <DropdownMenuSeparator />
            <p className="text-muted-foreground px-2 py-1.5 text-xs">{ready.description}</p>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const modelPicker = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-background/85 h-[30px] gap-1.5 rounded-lg px-2.5 text-xs font-medium shadow-sm backdrop-blur"
          aria-label={`3D model: ${model.label}`}
        >
          <Box className="size-3.5" />
          {model.label}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>3D model</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={style} onValueChange={(v) => changeModel(v as ModelStyle)}>
          {MODEL_STYLES.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value} className="flex-col items-start gap-0">
              <span>{o.label}</span>
              <span className="text-muted-foreground text-xs">{o.hint}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const teethOn = layers.enamel || layers.dentin;
  const unavailable = "Not in this model — needs an anatomical model with this layer";

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          "relative h-[min(62vh,600px)] min-h-[420px] overflow-hidden rounded-2xl border",
          "bg-[radial-gradient(ellipse_at_50%_40%,#ffffff,#e6f1f9_70%,#d7e7f3)]",
          className
        )}
      >
        {imageMode ? (
          <DentalChartFallback
            teeth={teeth}
            selected={selected}
            onSelect={onSelect}
            reason={FALLBACK_COPY[imageMode].reason}
            hint={FALLBACK_COPY[imageMode].hint}
            onTryInteractive={
              imageMode === "none"
                ? undefined
                : () => {
                    setForceInteractive(true);
                    setFallback(null);
                    setSceneKey((k) => k + 1);
                  }
            }
          />
        ) : (
          <SceneErrorBoundary key={sceneKey} onError={() => setFallback("crashed")}>
            <DentalScene
              teeth={teeth}
              selected={selected}
              onSelect={onSelect}
              jaw={jaw}
              gumMode={gumMode}
              isolate={isolate}
              showStatus={showStatus}
              showLabels={showLabels}
              camera={camera}
              layers={layers}
              section={section}
              dragMode={dragMode}
              modelUrl={model.url}
              onApi={onApi}
              onSourceChange={setSourceInfo}
              onContextLost={() => setFallback("lost")}
            />
          </SceneErrorBoundary>
        )}

        {teeth.length === 0 && (
          <div className="text-muted-foreground absolute inset-0 flex items-center justify-center text-sm">
            No dental record found for this patient.
          </div>
        )}

        {/* Quadrant captions, from the viewer's side (patient's right is on the left). */}
        {isFrontView && (
          <div className="text-muted-foreground pointer-events-none absolute inset-x-[19%] inset-y-14 hidden text-[11px] font-medium md:block">
            {[
              ["Upper right", "top-0 left-0"],
              ["Upper left", "top-0 right-0"],
              ["Lower right", "bottom-0 left-0"],
              ["Lower left", "bottom-0 right-0"],
            ].map(([label, pos]) => (
              <span key={label} className={cn("bg-background/80 absolute rounded-md border px-2 py-0.5", pos)}>
                {label}
              </span>
            ))}
          </div>
        )}

        {!imageMode && (
        <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            {modelPicker}
            <Segmented label="Jaw" options={JAW_OPTIONS} value={isolate === "all" ? jaw : null} onChange={changeJaw} />
          </div>
          {compact && (
            <div className="pointer-events-auto mr-16">
              <Segmented label="Camera angle" options={PRESETS} value={null} onChange={choosePreset} />
            </div>
          )}
        </div>
        )}

        {legend && <div className="absolute top-14 left-3 hidden w-36 sm:block">{legend}</div>}

        {!imageMode && (
        <div
          role="toolbar"
          aria-label="Camera controls"
          className="bg-background/90 absolute top-3 right-3 flex flex-col items-center gap-0.5 rounded-xl border p-1 shadow-sm backdrop-blur"
        >
          <RailButton label="Rotate (drag)" pressed={dragMode === "rotate"} onClick={() => setDragMode("rotate")}>
            <Rotate3d /> <span>Rotate</span>
          </RailButton>
          <RailButton label="Pan (drag)" pressed={dragMode === "pan"} onClick={() => setDragMode("pan")}>
            <Hand /> <span>Pan</span>
          </RailButton>
          <RailButton label="Zoom in" onClick={() => api.current?.zoom(1)}>
            <ZoomIn /> <span>Zoom in</span>
          </RailButton>
          <RailButton label="Zoom out" onClick={() => api.current?.zoom(-1)}>
            <ZoomOut /> <span>Zoom out</span>
          </RailButton>
          <RailButton label="Reset view" onClick={reset}>
            <RotateCcw /> <span>Reset</span>
          </RailButton>
          <RailButton label="Fit model to view" onClick={() => aim(isolate === "all" ? lastPreset : "focus")}>
            <Maximize2 /> <span>Fit view</span>
          </RailButton>
          {!compact && (
            <RailButton label="Save screenshot (PNG, no patient details)" onClick={screenshot}>
              <Camera /> <span>Capture</span>
            </RailButton>
          )}
        </div>
        )}

        {!compact && (
          <div className="absolute bottom-3 left-3 hidden sm:block">
            <ArchMinimap teeth={teeth} selected={selected} onSelect={onSelect} />
          </div>
        )}

        {selected !== null && !imageMode && (
          <div className="pointer-events-none absolute inset-x-2 bottom-3 flex justify-center">
            <div className="bg-background/90 pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-lg border p-1 pl-2.5 shadow-sm backdrop-blur">
              <span className="text-xs font-medium">
                <span className="tabular-nums">#{selected}</span>
                <span className="text-muted-foreground"> · {toothName(selected).replace(/^(Upper|Lower) (Left|Right) /, "")}</span>
              </span>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={() => aim("focus")}>
                <Crosshair className="size-3.5" /> Focus
              </Button>
              <Segmented label="Isolate" options={ISOLATE_OPTIONS} value={isolate} onChange={changeIsolate} />
              <Button
                variant={section ? "default" : "ghost"}
                size="sm"
                aria-pressed={section}
                className="h-7 gap-1.5 px-2 text-xs"
                title="Cut the tooth to show enamel, dentin and pulp (view only)"
                onClick={toggleSection}
              >
                <Scissors className="size-3.5" /> Cross-section
              </Button>
            </div>
          </div>
        )}

        {!imageMode && sourceInfo?.status === "loading" && (
          <div className="text-muted-foreground pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm">
            <Spinner className="size-5" />
            Loading {model.label.toLowerCase()} model…
          </div>
        )}

        {ready && (ready.fallbackReason || ready.warnings.length > 0) && (
          <div className="pointer-events-none absolute inset-x-2 bottom-14 flex justify-center">
            <p
              className="flex max-w-xl items-start gap-2 rounded-lg border border-amber-300/70 bg-amber-50/95 px-3 py-1.5 text-xs text-amber-900 shadow-sm"
              title={ready.warnings.join("\n")}
            >
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              {ready.fallbackReason
                ? `The ${model.label.toLowerCase()} model couldn't be loaded, so the schematic model is shown.`
                : `The ${model.label.toLowerCase()} model is incomplete: ${ready.warnings[0]}`}
            </p>
          </div>
        )}

        {ready?.kind === "procedural" && selected === null && (
          <p className="text-muted-foreground pointer-events-none absolute right-24 bottom-3 hidden text-[11px] md:block">
            Schematic model · average proportions
          </p>
        )}

        {/* The model's licence (e.g. CC BY-SA) requires this credit to stay visible. */}
        {ready?.credit && (
          <p className="text-muted-foreground absolute right-3 bottom-1 max-w-[70%] text-right text-[10px] leading-tight sm:right-24 sm:bottom-3 sm:text-[11px]">
            {ready.credit.url ? (
              <a href={ready.credit.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {ready.credit.text}
              </a>
            ) : (
              ready.credit.text
            )}
          </p>
        )}
      </div>

      {!compact && !imageMode && (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <div role="group" aria-label="Views" className="flex gap-2 overflow-x-auto rounded-2xl border bg-white/70 p-2">
            {PRESETS.map((p) => (
              <ViewTile
                key={p.value}
                label={`${p.label} view`}
                image={views[p.value]}
                icon={<Box />}
                active={presetActive(p.value)}
                onClick={() => choosePreset(p.value)}
              />
            ))}
            <ViewTile
              label="Isolated tooth"
              icon={<ToothIcon />}
              active={isolate === "tooth"}
              disabled={selected === null}
              title={selected === null ? "Select a tooth first" : "Show the selected tooth on its own"}
              onClick={() => changeIsolate(isolate === "tooth" ? "all" : "tooth")}
            />
            <ViewTile
              label="Cross-section"
              icon={<Scissors />}
              active={section}
              disabled={selected === null}
              title={selected === null ? "Select a tooth first" : "Cut the selected tooth open (view only)"}
              onClick={toggleSection}
            />
            <ViewTile
              label="Transparent gums"
              icon={<Layers />}
              active={gumMode === "translucent"}
              onClick={() => setGumMode(gumMode === "translucent" ? "solid" : "translucent")}
            />
          </div>

          <section aria-label="Show layers" className="rounded-2xl border bg-white/70 px-4 py-3">
            <h3 className="mb-1.5 text-sm font-semibold">Show layers</h3>
            <LayerSwitch
              label="Teeth"
              checked={teethOn}
              onChange={(on) => setLayers((l) => ({ ...l, enamel: on, dentin: on }))}
            />
            <LayerSwitch
              label="Gums"
              checked={gumMode !== "hidden"}
              onChange={(on) => setGumMode(on ? "solid" : "hidden")}
            />
            <LayerSwitch
              label="Jaw bone"
              checked={Boolean(ready?.available.bone) && layers.bone}
              disabled={!ready?.available.bone}
              hint={ready?.available.bone ? undefined : unavailable}
              onChange={(on) => setLayers((l) => ({ ...l, bone: on }))}
            />
            <LayerSwitch
              label="Nerves & vessels"
              checked={Boolean(ready?.available.nerve) && layers.nerve}
              disabled={!ready?.available.nerve}
              hint={ready?.available.nerve ? undefined : unavailable}
              onChange={(on) => setLayers((l) => ({ ...l, nerve: on }))}
            />
            <LayerSwitch
              label="Cross-section"
              checked={section}
              disabled={selected === null}
              hint={selected === null ? "Select a tooth first" : undefined}
              onChange={() => toggleSection()}
            />
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 border-t pt-1.5">
              <button
                type="button"
                onClick={() => setShowLabels((v) => !v)}
                className={cn("flex items-center gap-1 text-xs", showLabels ? "text-primary" : "text-muted-foreground")}
                aria-pressed={showLabels}
              >
                <Hash className="size-3.5" /> Numbers
              </button>
              <button
                type="button"
                onClick={() => setShowStatus((v) => !v)}
                className={cn("flex items-center gap-1 text-xs", showStatus ? "text-primary" : "text-muted-foreground")}
                aria-pressed={showStatus}
                title={showStatus ? "Hide status overlay (natural anatomy)" : "Show status overlay"}
              >
                <Tag className="size-3.5" /> Status colours
              </button>
            </div>
            {advancedLayers}
          </section>
        </div>
      )}
    </div>
  );
}
