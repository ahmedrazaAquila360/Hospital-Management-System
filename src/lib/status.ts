export type StatusTone = "neutral" | "info" | "success" | "warning" | "destructive";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent ring-1 ring-inset ring-border",
  info: "bg-pale text-primary border-transparent ring-1 ring-inset ring-[#cde5f4]",
  success: "bg-[#e7f6ef] text-success border-transparent ring-1 ring-inset ring-[#c4e9d6]",
  warning: "bg-[#fff4e1] text-warning-foreground border-transparent ring-1 ring-inset ring-[#f5dcae]",
  destructive: "bg-[#fdedef] text-destructive border-transparent ring-1 ring-inset ring-[#f5ccd2]",
};

export function toneClasses(tone: StatusTone) {
  return TONE_CLASSES[tone];
}

export const APPOINTMENT_STATUS_TONE: Record<string, StatusTone> = {
  SCHEDULED: "info",
  CONFIRMED: "info",
  CHECKED_IN: "warning",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "destructive",
  NO_SHOW: "destructive",
};

export const TREATMENT_STATUS_TONE: Record<string, StatusTone> = {
  PLANNED: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "destructive",
};

/** Per-status accents for treatment cards: badge border, left edge, progress bar fill. */
export const TREATMENT_STATUS_ACCENT: Record<string, { badge: string; edge: string; bar: string }> = {
  PLANNED: {
    badge: "border-primary/40",
    edge: "border-l-primary",
    bar: "bg-primary/15 [&_[data-slot=progress-indicator]]:bg-primary",
  },
  IN_PROGRESS: {
    badge: "border-warning/70 bg-warning/25",
    edge: "border-l-warning",
    bar: "bg-warning/20 [&_[data-slot=progress-indicator]]:bg-warning",
  },
  COMPLETED: {
    badge: "border-success/50",
    edge: "border-l-success",
    bar: "bg-success/15 [&_[data-slot=progress-indicator]]:bg-success",
  },
  CANCELLED: {
    badge: "border-destructive/40",
    edge: "border-l-destructive",
    bar: "bg-destructive/15 [&_[data-slot=progress-indicator]]:bg-destructive",
  },
};

export const INVOICE_STATUS_TONE: Record<string, StatusTone> = {
  VOIDED: "neutral",
  UNPAID: "destructive",
  PARTIALLY_PAID: "warning",
  PAID: "success",
};

export const USER_STATUS_TONE: Record<string, StatusTone> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
};
