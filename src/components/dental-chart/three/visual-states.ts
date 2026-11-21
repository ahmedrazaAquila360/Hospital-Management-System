import type { ToothConditionKey } from "@/lib/dental";

/**
 * How each recorded condition is drawn on the 3D model. `where` is the short,
 * dentist-facing description shown in the legend; the 2D chart's CONDITION_META
 * colours are reused for tooth-number pills so both views share one colour key.
 */
export const CONDITION_3D: Record<ToothConditionKey, { where: string; usesSurface: boolean }> = {
  HEALTHY: { where: "Natural enamel", usesSurface: false },
  CARIES: { where: "Dark lesion on the affected surface", usesSurface: true },
  FILLED: { where: "Restoration inlaid on the recorded surface", usesSurface: true },
  CROWN: { where: "Full-coverage gold crown", usesSurface: false },
  ROOT_CANAL: { where: "Obturated canals visible through the root", usesSurface: false },
  EXTRACTION: { where: "Tooth ghosted and marked with a red ✕", usesSurface: false },
  MISSING: { where: "Empty position with dashed outline", usesSurface: false },
  IMPLANT: { where: "Titanium fixture with ceramic crown", usesSurface: false },
  BRIDGE: { where: "Ceramic unit joined to neighbouring bridge teeth", usesSurface: false },
  FRACTURE: { where: "Crack line across the buccal face", usesSurface: false },
  OTHER: { where: "Tinted crown — see notes", usesSurface: false },
};

/** Surfaces drawn when a condition that uses surfaces has none recorded. */
export function defaultSurface(toothNumber: number) {
  return toothNumber % 10 <= 3 ? ("Buccal" as const) : ("Occlusal" as const);
}
