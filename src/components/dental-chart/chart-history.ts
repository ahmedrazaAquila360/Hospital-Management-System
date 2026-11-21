import type { ToothConditionKey } from "@/lib/dental";
import type { getDentalChartForPatient } from "@/server/dental-chart/queries";

type Patient = NonNullable<Awaited<ReturnType<typeof getDentalChartForPatient>>>;
export type ChartTooth = NonNullable<Patient["dentalRecord"]>["teeth"][number];

/**
 * The chart as it was recorded at the end of `date`, rebuilt only from saved
 * condition history (newest first on each tooth). A tooth with nothing recorded by
 * then shows the record's default (Normal) and is flagged `unrecorded`, so the UI
 * can say so rather than imply a finding.
 */
export function chartAsOf(teeth: ChartTooth[], date: Date) {
  const cutoff = new Date(date);
  cutoff.setHours(23, 59, 59, 999);
  return teeth.map((t) => {
    const idx = t.conditions.findIndex((c) => new Date(c.recordedAt) <= cutoff);
    const unrecorded = idx === -1;
    return {
      tooth: {
        ...t,
        currentCondition: (unrecorded ? "HEALTHY" : t.conditions[idx].condition) as ToothConditionKey,
        conditions: unrecorded ? [] : t.conditions.slice(idx),
      } as ChartTooth,
      unrecorded,
    };
  });
}

/** Distinct calendar days on which any tooth status was recorded, newest first. */
export function recordedDays(teeth: ChartTooth[]) {
  const days = new Map<string, Date>();
  for (const t of teeth) {
    for (const c of t.conditions) {
      const d = new Date(c.recordedAt);
      const key = d.toDateString();
      if (!days.has(key)) days.set(key, new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    }
  }
  return [...days.values()].sort((a, b) => b.getTime() - a.getTime());
}
