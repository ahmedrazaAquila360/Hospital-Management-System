export const TOOTH_CONDITIONS = [
  "HEALTHY",
  "FILLED",
  "CROWN",
  "ROOT_CANAL",
  "EXTRACTION",
  "IMPLANT",
  "MISSING",
  "CARIES",
  "BRIDGE",
  "FRACTURE",
  "OTHER",
] as const;

export type ToothConditionKey = (typeof TOOTH_CONDITIONS)[number];

// Status palette shared by the 2D chart, 3D tooth labels, legends and timelines.
export const CONDITION_META: Record<ToothConditionKey, { label: string; color: string; textColor: string }> = {
  HEALTHY: { label: "Normal", color: "var(--muted)", textColor: "var(--muted-foreground)" },
  FILLED: { label: "Filling", color: "#3b82f6", textColor: "#ffffff" },
  CROWN: { label: "Crown", color: "#eab308", textColor: "#422006" },
  ROOT_CANAL: { label: "Root Canal", color: "#f43f5e", textColor: "#ffffff" },
  EXTRACTION: { label: "Extraction", color: "#dc2626", textColor: "#ffffff" },
  IMPLANT: { label: "Implant", color: "#6b7280", textColor: "#ffffff" },
  MISSING: { label: "Missing", color: "transparent", textColor: "var(--muted-foreground)" },
  CARIES: { label: "Caries", color: "#b45309", textColor: "#ffffff" },
  BRIDGE: { label: "Bridge", color: "#8b5cf6", textColor: "#ffffff" },
  FRACTURE: { label: "Fracture", color: "#f59e0b", textColor: "#451a03" },
  OTHER: { label: "Other", color: "#22c55e", textColor: "#ffffff" },
};

// FDI notation, upper arch left-to-right then lower arch left-to-right (as viewed facing the patient).
export const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
export const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];
export const LOWER_RIGHT = [41, 42, 43, 44, 45, 46, 47, 48];

// Primary (child) teeth, FDI quadrants 5–8, in the same left-to-right layout as above.
export const UPPER_RIGHT_PRIMARY = [55, 54, 53, 52, 51];
export const UPPER_LEFT_PRIMARY = [61, 62, 63, 64, 65];
export const LOWER_LEFT_PRIMARY = [71, 72, 73, 74, 75];
export const LOWER_RIGHT_PRIMARY = [81, 82, 83, 84, 85];

export const PERMANENT_TEETH = [...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_LEFT, ...LOWER_RIGHT];
export const PRIMARY_TEETH = [...UPPER_RIGHT_PRIMARY, ...UPPER_LEFT_PRIMARY, ...LOWER_LEFT_PRIMARY, ...LOWER_RIGHT_PRIMARY];

export function isPrimaryTooth(toothNumber: number) {
  return PRIMARY_TEETH.includes(toothNumber);
}

/** A real FDI tooth number: permanent 11–48 or primary 51–85. */
export function isValidToothNumber(toothNumber: number) {
  return PERMANENT_TEETH.includes(toothNumber) || PRIMARY_TEETH.includes(toothNumber);
}

export function quadrantLabel(toothNumber: number) {
  const q = Math.floor(toothNumber / 10);
  // Quadrants 5–8 are the same positions for primary teeth.
  return { 1: "Upper Right", 2: "Upper Left", 3: "Lower Left", 4: "Lower Right", 5: "Upper Right", 6: "Upper Left", 7: "Lower Left", 8: "Lower Right" }[q] ?? "Unknown";
}

const TOOTH_TYPE_NAMES = [
  "Central Incisor",
  "Lateral Incisor",
  "Canine",
  "First Premolar",
  "Second Premolar",
  "First Molar",
  "Second Molar",
  "Third Molar",
];

// Primary teeth have no premolars: positions 4 and 5 are the first and second molars.
const PRIMARY_TYPE_NAMES = ["Central Incisor", "Lateral Incisor", "Canine", "First Molar", "Second Molar"];

/** Anatomical class of a tooth: Incisor, Canine, Premolar or Molar. */
export function toothType(toothNumber: number) {
  const pos = toothNumber % 10;
  if (isPrimaryTooth(toothNumber)) return pos <= 2 ? "Incisor" : pos === 3 ? "Canine" : "Molar";
  return pos <= 2 ? "Incisor" : pos === 3 ? "Canine" : pos <= 5 ? "Premolar" : "Molar";
}

/** e.g. 16 → "Upper Right First Molar", 54 → "Upper Right Primary First Molar" (FDI notation). */
export function toothName(toothNumber: number) {
  if (isPrimaryTooth(toothNumber)) {
    return `${quadrantLabel(toothNumber)} Primary ${PRIMARY_TYPE_NAMES[(toothNumber % 10) - 1] ?? "Tooth"}`;
  }
  const type = TOOTH_TYPE_NAMES[(toothNumber % 10) - 1] ?? "Tooth";
  return `${quadrantLabel(toothNumber)} ${type}`;
}

export const TOOTH_SURFACES = ["Mesial", "Occlusal", "Distal", "Buccal", "Lingual"] as const;
export type ToothSurface = (typeof TOOTH_SURFACES)[number];

const SURFACE_ALIASES: Record<string, ToothSurface> = {
  m: "Mesial",
  mesial: "Mesial",
  d: "Distal",
  distal: "Distal",
  o: "Occlusal",
  occlusal: "Occlusal",
  i: "Occlusal",
  incisal: "Occlusal",
  b: "Buccal",
  buccal: "Buccal",
  f: "Buccal",
  facial: "Buccal",
  labial: "Buccal",
  l: "Lingual",
  lingual: "Lingual",
  p: "Lingual",
  palatal: "Lingual",
};

/**
 * Parses the free-text surface field recorded on a condition ("Mesial, Occlusal",
 * "MOD", "buccal/lingual") into canonical surfaces. Unknown tokens are ignored.
 */
export function parseSurfaces(surface: string | null | undefined): ToothSurface[] {
  if (!surface) return [];
  const found = new Set<ToothSurface>();
  for (const raw of surface.toLowerCase().split(/[\s,/;+&-]+/)) {
    if (!raw) continue;
    if (SURFACE_ALIASES[raw]) {
      found.add(SURFACE_ALIASES[raw]);
    } else if (/^[modbflip]{2,5}$/.test(raw)) {
      for (const ch of raw) found.add(SURFACE_ALIASES[ch]);
    }
  }
  return TOOTH_SURFACES.filter((s) => found.has(s));
}

/** Anterior teeth (incisors + canines) have an incisal edge and labial face rather than occlusal/buccal. */
export function surfaceLabel(surface: ToothSurface, toothNumber: number) {
  const anterior = toothNumber % 10 <= 3;
  const upper = Math.floor(toothNumber / 10) <= 2;
  if (surface === "Occlusal" && anterior) return "Incisal";
  if (surface === "Buccal" && anterior) return "Labial";
  if (surface === "Lingual" && upper) return "Palatal";
  return surface;
}
