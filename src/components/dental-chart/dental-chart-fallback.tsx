"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AlertTriangle, Box, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CONDITION_META, toothName } from "@/lib/dental";
import { cn } from "@/lib/utils";
import type { SceneTooth } from "./three/dental-scene";

/*
 * Image-based dental model for devices that can't run the interactive WebGL view
 * (graphics blocked or missing, or only slow software rendering). The images are
 * pre-rendered from the same anatomical model (scripts/render-dentition-fallback.mjs);
 * the patient's recorded statuses are shown on the tooth labels, which select teeth
 * exactly like the 3D view.
 */

type Frame = { src: string; yaw: number | null; anchors: Record<string, [number, number]> };
type Manifest = {
  width: number;
  height: number;
  /** Attribution the source model's licence requires. */
  credit?: { text: string; url?: string };
  views: Record<"front" | "upper" | "lower", Frame[]>;
};
type FallbackView = keyof Manifest["views"];

let manifestPromise: Promise<Manifest> | null = null;
function loadManifest() {
  manifestPromise ??= fetch("/models/fallback/views.json").then((r) => {
    if (!r.ok) throw new Error(`views.json ${r.status}`);
    return r.json() as Promise<Manifest>;
  });
  return manifestPromise;
}

const VIEWS: { value: FallbackView; label: string }[] = [
  { value: "front", label: "Front" },
  { value: "upper", label: "Upper" },
  { value: "lower", label: "Lower" },
];

const DRAG_STEP = 36; // px of horizontal drag per turntable step

export function DentalChartFallback({
  teeth,
  selected,
  onSelect,
  reason,
  hint,
  onTryInteractive,
}: {
  teeth: SceneTooth[];
  selected: number | null;
  onSelect: (toothNumber: number) => void;
  /** Why the interactive view isn't used, in plain words. */
  reason: string;
  /** What the user can do about it, if anything. */
  hint?: string;
  onTryInteractive?: () => void;
}) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<FallbackView>("front");
  const [frameIndex, setFrameIndex] = useState<number | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(true);
  const drag = useRef<{ x: number; start: number } | null>(null);

  useEffect(() => {
    let live = true;
    loadManifest()
      .then((m) => live && setManifest(m))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const frames = manifest?.views[view] ?? [];
  const middle = Math.floor(frames.length / 2);
  const index = view === "front" ? Math.min(frames.length - 1, Math.max(0, frameIndex ?? middle)) : 0;
  const frame = frames[index];

  // Warm the cache for the turntable once the first image is up, so dragging is instant.
  useEffect(() => {
    if (!manifest) return;
    for (const f of [...manifest.views.front, ...manifest.views.upper, ...manifest.views.lower]) {
      const img = new Image();
      img.decoding = "async";
      img.src = f.src;
    }
  }, [manifest]);

  const byNumber = new Map(teeth.map((t) => [t.toothNumber, t]));

  function step(delta: number) {
    if (view !== "front") return;
    setFrameIndex(Math.min(frames.length - 1, Math.max(0, index + delta)));
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (view !== "front" || (e.target as HTMLElement).closest("button")) return;
    drag.current = { x: e.clientX, start: index };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const next = drag.current.start - Math.round((e.clientX - drag.current.x) / DRAG_STEP);
    setFrameIndex(Math.min(frames.length - 1, Math.max(0, next)));
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft") step(1);
    else if (e.key === "ArrowRight") step(-1);
    else return;
    e.preventDefault();
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex justify-center">
        {noticeOpen ? (
          <div className="pointer-events-auto flex max-w-lg items-start gap-2 rounded-lg border border-amber-300/70 bg-amber-50/95 px-3 py-1.5 text-xs text-amber-900 shadow-sm">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            <div>
              <p>
                <span className="font-medium">{reason}</span> Showing pre-rendered views; recorded statuses are on the
                tooth labels.
              </p>
              {hint && <p className="mt-0.5 opacity-80">{hint}</p>}
              {onTryInteractive && (
                <button type="button" onClick={onTryInteractive} className="mt-0.5 font-medium underline">
                  Try the interactive 3D view anyway
                </button>
              )}
            </div>
            <button type="button" aria-label="Hide this notice" onClick={() => setNoticeOpen(false)} className="-mr-1 shrink-0 opacity-70 hover:opacity-100">
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setNoticeOpen(true)}
            className="bg-background/90 text-muted-foreground pointer-events-auto flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] shadow-sm"
          >
            <Info className="size-3.5" /> Image view
          </button>
        )}
      </div>

      <div
        role="img"
        aria-label={`Dental model, ${view} view${view === "front" ? ". Drag or use arrow keys to turn it." : ""}`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={onKeyDown}
        className={cn(
          "relative flex min-h-0 flex-1 touch-none items-center justify-center outline-none select-none",
          view === "front" && "cursor-grab active:cursor-grabbing"
        )}
      >
        {failed ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 p-6 text-center text-sm">
            <Box className="size-8" />
            The model images couldn&apos;t be loaded. The 2D chart has the same data.
          </div>
        ) : !manifest || !frame ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 text-sm">
            <Spinner className="size-5" />
            Loading model views…
          </div>
        ) : (
          <div
            className="relative max-h-full w-full max-w-full"
            style={{ aspectRatio: `${manifest.width} / ${manifest.height}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static pre-rendered frames, already optimised WebP */}
            <img
              src={frame.src}
              alt=""
              draggable={false}
              decoding="async"
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            />
            {Object.entries(frame.anchors).map(([key, [x, y]]) => {
              const n = Number(key);
              const tooth = byNumber.get(n);
              if (!tooth) return null;
              const meta = CONDITION_META[tooth.condition];
              const plain = tooth.condition === "HEALTHY" || tooth.condition === "MISSING";
              const isSelected = selected === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onSelect(n)}
                  title={`${toothName(n)} · ${meta.label}`}
                  aria-label={`Tooth ${n}, ${meta.label}`}
                  aria-pressed={isSelected}
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-semibold tabular-nums shadow-sm",
                    isSelected && "ring-primary ring-offset-background z-10 px-2 py-1 text-[11px] ring-2 ring-offset-1"
                  )}
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    background: plain ? "var(--background)" : meta.color,
                    color: plain ? "var(--foreground)" : meta.textColor,
                    borderStyle: tooth.condition === "MISSING" ? "dashed" : "solid",
                    borderColor: "color-mix(in oklab, var(--foreground) 18%, transparent)",
                  }}
                >
                  {n}
                  {isSelected && <span className="ml-1 font-medium">· {meta.label}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Left padding keeps clear of the arch map floating in the viewport's corner. */}
      {manifest && (
        <div className="flex flex-wrap items-center justify-center gap-3 px-3 pb-3 sm:pl-32">
          <div role="group" aria-label="View" className="bg-background/85 flex rounded-lg border p-0.5 shadow-sm">
            {VIEWS.map((v) => (
              <button
                key={v.value}
                type="button"
                aria-pressed={view === v.value}
                onClick={() => setView(v.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  view === v.value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
          {view === "front" && (
            <label className="text-muted-foreground flex items-center gap-2 text-xs">
              Turn
              <input
                type="range"
                min={0}
                max={frames.length - 1}
                value={frames.length - 1 - index}
                onChange={(e) => setFrameIndex(frames.length - 1 - Number(e.target.value))}
                className="accent-primary w-40"
                aria-label="Turn the model"
              />
            </label>
          )}
          {onTryInteractive && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onTryInteractive}>
              Interactive 3D
            </Button>
          )}
          {manifest.credit && (
            <a
              href={manifest.credit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground w-full text-center text-[10px] hover:underline sm:w-auto sm:text-[11px]"
            >
              {manifest.credit.text}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
