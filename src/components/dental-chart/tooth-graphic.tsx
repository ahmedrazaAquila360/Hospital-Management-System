import type { ToothConditionKey, ToothSurface } from "@/lib/dental";

/*
 * Illustrated tooth (buccal view) for the 2D chart. Drawn in a 40×100 box with the
 * crown at the top and roots pointing down; upper teeth are flipped vertically so
 * their crowns face the occlusal plane in the middle of the chart.
 */

type Kind = "incisor" | "canine" | "premolar" | "molar";

type Shape = { crown: string; root: string; canals: string[]; pulp: string };

const SHAPES: Record<Kind, Shape> = {
  molar: {
    crown:
      "M5 42 C3 32 2 18 4 10 C5.5 5 9 4.5 11.5 7 C13 3 17.5 2.5 20 5.5 C22.5 2.5 27 3 28.5 7 C31 4.5 34.5 5 36 10 C38 18 37 32 35 42 Z",
    root: "M7 40 C7 58 8.5 76 11 90 C12 94.5 15.5 94.5 16 90 C16.5 76 17 62 20 54 C23 62 23.5 76 24 90 C24.5 94.5 28 94.5 29 90 C31.5 76 33 58 33 40 Z",
    canals: ["M13.5 46 C13.5 62 13 76 13.5 88", "M26.5 46 C26.5 62 27 76 26.5 88"],
    pulp: "M11 40 C11 33 14 30 20 30 C26 30 29 33 29 40 C29 44 26 47 20 47 C14 47 11 44 11 40 Z",
  },
  premolar: {
    crown: "M8 42 C6.5 31 6.5 18 9 10.5 C11.5 5 15.5 3 20 1.5 C24.5 3 28.5 5 31 10.5 C33.5 18 33.5 31 32 42 Z",
    root: "M10 40 C10.5 60 14 80 18.5 94 C19.3 96.3 20.7 96.3 21.5 94 C26 80 29.5 60 30 40 Z",
    canals: ["M20 44 C20 62 20 78 20 91"],
    pulp: "M14 40 C14 34 17 30 20 28 C23 30 26 34 26 40 C26 44 23 47 20 47 C17 47 14 44 14 40 Z",
  },
  canine: {
    crown: "M9 42 C7.5 31 7.5 19 10.5 11.5 C13 6 16.5 3 20 0.8 C23.5 3 27 6 29.5 11.5 C32.5 19 32.5 31 31 42 Z",
    root: "M10.5 40 C11 64 15 86 19 98 C19.6 99.4 20.4 99.4 21 98 C25 86 29 64 29.5 40 Z",
    canals: ["M20 43 C20 64 20 82 20 95"],
    pulp: "M15 40 C15 32 18 22 20 18 C22 22 25 32 25 40 C25 44 23 47 20 47 C17 47 15 44 15 40 Z",
  },
  incisor: {
    crown: "M9 42 C7 31 6.5 15 8 6.5 C8.8 2.8 12 1.6 20 1.6 C28 1.6 31.2 2.8 32 6.5 C33.5 15 33 31 31 42 Z",
    root: "M11 40 C11.5 60 15 80 18.8 93 C19.4 95 20.6 95 21.2 93 C25 80 28.5 60 29 40 Z",
    canals: ["M20 43 C20 62 20 78 20 90"],
    pulp: "M15 40 C15 30 17 16 20 12 C23 16 25 30 25 40 C25 44 23 47 20 47 C17 47 15 44 15 40 Z",
  },
};

// Relative crown widths by position 1–8, so incisors/molars read at a glance.
const UPPER_WIDTH = [1, 0.92, 0.95, 0.93, 0.92, 1.04, 1, 0.96];
const LOWER_WIDTH = [0.86, 0.88, 0.93, 0.93, 0.93, 1.04, 1.02, 1];

function kindFor(toothNumber: number): Kind {
  const pos = toothNumber % 10;
  if (pos <= 2) return "incisor";
  if (pos === 3) return "canine";
  if (pos <= 5) return "premolar";
  return "molar";
}

export function isUpperTooth(toothNumber: number) {
  return Math.floor(toothNumber / 10) <= 2;
}

/** Shared gradients for every tooth on the page — render once, reference by `idPrefix`. */
export function ToothGraphicDefs({ idPrefix }: { idPrefix: string }) {
  const stops = (id: string, colors: string[]) => (
    <linearGradient id={`${idPrefix}-${id}`} x1="0" x2="1" y1="0" y2="0">
      {colors.map((c, i) => (
        <stop key={i} offset={`${(i / (colors.length - 1)) * 100}%`} stopColor={c} />
      ))}
    </linearGradient>
  );
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        {stops("enamel", ["#e6dccb", "#fffdf8", "#fbf6ec", "#dfd3bf"])}
        {stops("root", ["#dcc79c", "#f7ebd0", "#efdfbc", "#cfb98b"])}
        {stops("gold", ["#b8871a", "#f8dc86", "#e8b84a", "#a97a14"])}
        {stops("metal", ["#727b88", "#d5dae1", "#a8afba", "#68707d"])}
        {stops("filling", ["#3f63a3", "#cddcf6", "#8fabdc", "#3d5f9c"])}
        {stops("ceramic", ["#c6baea", "#f8f5ff", "#e5dcfa", "#b8a9e4"])}
        {stops("titanium", ["#5f6875", "#d3d8de", "#9aa2ad", "#59616d"])}
        {stops("other", ["#b6dfc1", "#f3fbf5", "#dcf2e1", "#a6d6b2"])}
        {/* Rounded, lit-from-top-left volume laid over each crown. */}
        <radialGradient id={`${idPrefix}-shine`} cx="0.34" cy="0.3" r="0.8">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.75} />
          <stop offset="45%" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="100%" stopColor="#8f7a55" stopOpacity={0.28} />
        </radialGradient>
        <linearGradient id={`${idPrefix}-root-shade`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#7a5a26" stopOpacity={0} />
          <stop offset="100%" stopColor="#7a5a26" stopOpacity={0.28} />
        </linearGradient>
        <linearGradient id={`${idPrefix}-pulp`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#be123c" />
          <stop offset="50%" stopColor="#fb4a64" />
          <stop offset="100%" stopColor="#be123c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function surfaceShape(surface: ToothSurface, kind: Kind, mesialOnLeft: boolean, fill: string, key: string, stroke?: string) {
  const anterior = kind === "incisor" || kind === "canine";
  const common = { fill, stroke, strokeWidth: stroke ? 0.8 : 0, vectorEffect: "non-scaling-stroke" as const };
  switch (surface) {
    case "Occlusal":
      return anterior ? (
        <ellipse key={key} cx={20} cy={4.5} rx={9} ry={3.4} {...common} />
      ) : (
        <path key={key} d="M11 8 C14 5 17 9.5 20 7 C23 9.5 26 5 29 8 C29.5 12.5 24.5 15 20 15 C15.5 15 10.5 12.5 11 8 Z" {...common} />
      );
    case "Mesial":
    case "Distal": {
      const left = (surface === "Mesial") === mesialOnLeft;
      return <ellipse key={key} cx={left ? 8 : 32} cy={21} rx={5} ry={9} {...common} />;
    }
    case "Buccal":
      return <ellipse key={key} cx={20} cy={25} rx={6.5} ry={7.5} {...common} />;
    case "Lingual":
      // Not visible from the buccal side — show it ghosted behind the face.
      return <ellipse key={key} cx={20} cy={25} rx={6.5} ry={7.5} fill={fill} opacity={0.45} strokeDasharray="2 1.5" stroke="#4b5563" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />;
  }
}

/** Roots are drawn ~38% shorter than anatomical so crowns read larger in the chart. */
const ROOT_SQUASH = "translate(0 42) scale(1 0.62) translate(0 -42)";
const VIEW_HEIGHT = 78;

export function ToothGraphic({
  toothNumber,
  condition,
  surfaces,
  idPrefix,
  className,
}: {
  toothNumber: number;
  condition: ToothConditionKey;
  surfaces: ToothSurface[];
  idPrefix: string;
  className?: string;
}) {
  const kind = kindFor(toothNumber);
  const shape = SHAPES[kind];
  const upper = isUpperTooth(toothNumber);
  // Drawn ~12% fuller than the base outlines so teeth fill their chart slot like a clinical odontogram.
  const width = ((upper ? UPPER_WIDTH : LOWER_WIDTH)[(toothNumber % 10) - 1] ?? 1) * 1.12;
  // Screen-left half of the chart is the patient's right (quadrants 1 & 4): mesial faces right.
  const q = Math.floor(toothNumber / 10);
  const mesialOnLeft = q === 2 || q === 3;
  const clipId = `${idPrefix}-clip-${toothNumber}`;
  const url = (id: string) => `url(#${idPrefix}-${id})`;

  const missing = condition === "MISSING";
  const crownFill =
    condition === "CROWN"
      ? url("gold")
      : condition === "BRIDGE"
        ? url("ceramic")
        : condition === "OTHER"
          ? url("other")
          : url("enamel");
  const crownStroke =
    condition === "CROWN" ? "#a47812" : condition === "BRIDGE" ? "#9b8bd0" : condition === "OTHER" ? "#8cc79b" : "#d2c6b0";
  const patchSurfaces = surfaces.length > 0 ? surfaces : [kind === "incisor" || kind === "canine" ? "Buccal" : "Occlusal"] as ToothSurface[];

  const flip = upper ? `translate(0 ${VIEW_HEIGHT}) scale(1 -1)` : "";
  const squeeze = `translate(20 0) scale(${width} 1) translate(-20 0)`;

  return (
    <svg viewBox={`0 0 40 ${VIEW_HEIGHT}`} preserveAspectRatio="none" className={className} overflow="visible" aria-hidden>
      <defs>
        <clipPath id={clipId}>
          <path d={shape.crown} />
        </clipPath>
      </defs>
      <g transform={`${flip} ${squeeze}`} opacity={condition === "EXTRACTION" ? 0.45 : 1}>
        {missing ? (
          <g fill="none" stroke="#94a3b8" strokeWidth={1.3} strokeDasharray="3 2.5">
            <path d={shape.root} transform={ROOT_SQUASH} vectorEffect="non-scaling-stroke" />
            <path d={shape.crown} vectorEffect="non-scaling-stroke" />
          </g>
        ) : (
          <>
            <g transform={ROOT_SQUASH}>
              {condition === "IMPLANT" ? (
                <g>
                  <path d="M14 44 L26 44 L25 87 C24 93 16 93 15 87 Z" fill={url("titanium")} stroke="#555d69" strokeWidth={0.7} vectorEffect="non-scaling-stroke" />
                  {Array.from({ length: 9 }, (_, i) => 48 + i * 4.6).map((y) => (
                    <path key={y} d={`M13.2 ${y} L26.8 ${y - 1.8}`} stroke="#4f5763" strokeWidth={1.4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  ))}
                  <rect x={15.5} y={36} width={9} height={10} rx={1} fill="#aab1bb" />
                </g>
              ) : (
                <>
                  <path d={shape.root} fill={url("root")} stroke="#c9b58c" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
                  <path d={shape.root} fill={url("root-shade")} />
                </>
              )}

              {condition === "ROOT_CANAL" &&
                shape.canals.map((d) => (
                  <g key={d}>
                    <path d={d} fill="none" stroke="#e11d48" strokeWidth={3.6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    <path d={d} fill="none" stroke="#fda4af" strokeWidth={1} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  </g>
                ))}
            </g>

            <path d={shape.crown} fill={crownFill} stroke={crownStroke} strokeWidth={0.9} vectorEffect="non-scaling-stroke" />

            <g clipPath={`url(#${clipId})`}>
              {condition === "ROOT_CANAL" && (
                <>
                  <path d={shape.pulp} fill={url("pulp")} />
                  <ellipse cx={20} cy={kind === "incisor" || kind === "canine" ? 5 : 9} rx={6} ry={3} fill={url("metal")} />
                </>
              )}
              {condition === "FILLED" &&
                patchSurfaces.map((s) => surfaceShape(s, kind, mesialOnLeft, url("filling"), s, "#35558f"))}
              {condition === "CARIES" &&
                patchSurfaces.map((s) => surfaceShape(s, kind, mesialOnLeft, "#5a2d0c", s, "#a0521d"))}
              {condition === "CROWN" && (
                <path d="M4 40 C12 37.5 28 37.5 36 40" stroke="#a47812" strokeWidth={1} fill="none" vectorEffect="non-scaling-stroke" />
              )}
              {/* rounded volume + specular highlight */}
              <path d={shape.crown} fill={url("shine")} />
              <ellipse cx={13} cy={17} rx={2.6} ry={9} fill="#ffffff" opacity={condition === "CROWN" ? 0.4 : 0.6} />
            </g>

            {condition === "FRACTURE" && (
              <path
                d="M7 15 L13 20.5 L17 16.5 L22.5 23 L27 18.5 L33 24"
                fill="none"
                stroke="#3b2a1a"
                strokeWidth={1.6}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {condition === "BRIDGE" && (
              <>
                <rect x={-4} y={18} width={9} height={8} rx={2} fill={url("ceramic")} stroke="#9b8bd0" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
                <rect x={35} y={18} width={9} height={8} rx={2} fill={url("ceramic")} stroke="#9b8bd0" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
              </>
            )}
          </>
        )}
      </g>

      {condition === "EXTRACTION" && (
        <g stroke="#dc2626" strokeWidth={2.6} strokeLinecap="round">
          <path d={upper ? "M9 40 L31 70" : "M9 8 L31 38"} vectorEffect="non-scaling-stroke" />
          <path d={upper ? "M31 40 L9 70" : "M31 8 L9 38"} vectorEffect="non-scaling-stroke" />
        </g>
      )}
    </svg>
  );
}
