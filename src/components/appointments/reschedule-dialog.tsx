"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, CalendarClock, CalendarDays, Check, Clock3, Info, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { IconInput } from "@/components/shared/icon-input";
import { RequiredMark } from "@/components/shared/record-form";
import { rescheduleAppointmentAction } from "@/server/appointments/actions";
import { dayFor, formatShifts, formatTime, workingHoursProblem, type WorkingHours } from "@/lib/working-hours";
import { cn } from "@/lib/utils";

type FieldName = "date" | "startTime" | "endTime";

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fromMinutes = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

function durationLabel(start: string, end: string) {
  const mins = toMinutes(end) - toMinutes(start);
  if (!(mins > 0)) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h && `${h} hr`, m && `${m} min`].filter(Boolean).join(" ");
}

function longDate(date: string) {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

/**
 * Reschedule modal: a new date and start/end time for the same visit. Checked in the browser
 * first (end after start, inside the clinic's hours, not in the past, actually different) and
 * again on the server, which also refuses completed and cancelled visits.
 */
export function RescheduleDialog({
  id,
  patientName,
  date,
  startTime,
  endTime,
  status,
  workingHours,
  triggerClassName,
}: {
  id: string;
  patientName: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm on the server's clock, as the edit form reads them. */
  startTime: string;
  endTime: string;
  status: string;
  workingHours: WorkingHours | null;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ date, startTime, endTime });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dayHours = workingHours && values.date ? dayFor(workingHours, values.date) : null;
  const duration = durationLabel(values.startTime, values.endTime);

  function onOpenChange(next: boolean) {
    if (isPending) return;
    setOpen(next);
    if (next) {
      setValues({ date, startTime, endTime });
      setErrors({});
      setFormError(null);
    }
  }

  function set(field: FieldName, value: string) {
    setValues((prev) => {
      // Moving the start keeps the visit's length, so a 30-minute slot stays 30 minutes.
      if (field === "startTime" && value && prev.startTime && prev.endTime) {
        const length = toMinutes(prev.endTime) - toMinutes(prev.startTime);
        if (length > 0) {
          const end = Math.min(toMinutes(value) + length, 23 * 60 + 59);
          return { ...prev, startTime: value, endTime: fromMinutes(end) };
        }
      }
      return { ...prev, [field]: value };
    });
    setErrors((prev) => ({ ...prev, [field]: undefined, ...(field === "startTime" ? { endTime: undefined } : {}) }));
    setFormError(null);
  }

  function validate(): Partial<Record<FieldName, string>> {
    const next: Partial<Record<FieldName, string>> = {};
    if (!values.date) next.date = "Select a date";
    if (!values.startTime) next.startTime = "Select a start time";
    if (!values.endTime) next.endTime = "Select an end time";
    if (Object.keys(next).length) return next;
    if (values.endTime <= values.startTime) return { endTime: "End time must be after start time" };
    if (values.date === date && values.startTime === startTime && values.endTime === endTime) {
      return { date: "Choose a different date or time" };
    }
    if (new Date(`${values.date}T${values.startTime}:00`).getTime() < Date.now()) {
      return { startTime: "That time has already passed. Choose a later time." };
    }
    const outside = workingHoursProblem(workingHours, values.date, values.startTime, values.endTime);
    if (outside) return { startTime: outside };
    return {};
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    setFormError(null);
    startTransition(async () => {
      try {
        const result = await rescheduleAppointmentAction(id, values);
        if (!result.ok) {
          if (result.field) setErrors({ [result.field]: result.error });
          else setFormError(result.error);
          return;
        }
        toast.success(`Rescheduled to ${longDate(values.date)} at ${formatTime(values.startTime)}.`);
        setOpen(false);
        router.refresh();
      } catch {
        setFormError("Couldn't reschedule the appointment. Please try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className={cn("rounded-full bg-white px-5 shadow-xs", triggerClassName)}>
          <CalendarDays className="text-brand" /> Reschedule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <DialogHeader className="flex-row items-center gap-3 px-6 pt-6 pb-4 text-left">
          <span className="bg-pale text-brand flex size-12 shrink-0 items-center justify-center rounded-2xl" aria-hidden>
            <CalendarClock className="size-5" />
          </span>
          <div>
            <DialogTitle className="text-navy text-xl">Reschedule Appointment</DialogTitle>
            <DialogDescription>Pick a new date and time for {patientName}.</DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="flex flex-col">
          <div className="grid gap-5 px-6 pb-5">
            <div className="bg-pale/70 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-4 py-3.5 text-sm">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Currently</span>
              <span className="text-navy inline-flex items-center gap-1.5 font-semibold">
                <CalendarDays className="text-brand size-4" aria-hidden /> {longDate(date)}
              </span>
              <span className="text-navy inline-flex items-center gap-1.5 font-semibold tabular-nums">
                <Clock3 className="text-brand size-4" aria-hidden /> {formatTime(startTime)} – {formatTime(endTime)}
              </span>
            </div>

            {status === "NO_SHOW" && (
              <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                This visit was marked as a no-show. Rescheduling books it again as Scheduled.
              </p>
            )}

            {formError && (
              <p role="alert" className="border-destructive/25 bg-destructive/5 text-destructive flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {formError}
              </p>
            )}

            <Field data-invalid={Boolean(errors.date)}>
              <FieldLabel htmlFor="reschedule-date">
                New Date <RequiredMark />
              </FieldLabel>
              <IconInput
                icon={<CalendarDays />}
                id="reschedule-date"
                type="date"
                value={values.date}
                onChange={(e) => set("date", e.target.value)}
                aria-invalid={Boolean(errors.date) || undefined}
                required
              />
              <FieldError>{errors.date}</FieldError>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.startTime)}>
                <FieldLabel htmlFor="reschedule-start">
                  Start Time <RequiredMark />
                </FieldLabel>
                <IconInput
                  icon={<Clock3 />}
                  id="reschedule-start"
                  type="time"
                  value={values.startTime}
                  onChange={(e) => set("startTime", e.target.value)}
                  aria-invalid={Boolean(errors.startTime) || undefined}
                  required
                />
                <FieldError>{errors.startTime}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.endTime)}>
                <FieldLabel htmlFor="reschedule-end">
                  End Time <RequiredMark />
                </FieldLabel>
                <IconInput
                  icon={<Clock3 />}
                  id="reschedule-end"
                  type="time"
                  value={values.endTime}
                  onChange={(e) => set("endTime", e.target.value)}
                  aria-invalid={Boolean(errors.endTime) || undefined}
                  required
                />
                <FieldError>{errors.endTime}</FieldError>
              </Field>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              {dayHours && (
                <p
                  className={cn(
                    "flex flex-1 items-start gap-2 rounded-xl px-3 py-2 text-xs",
                    dayHours.hours.closed ? "bg-destructive/5 text-destructive" : "bg-pale/60 text-foreground/80"
                  )}
                >
                  {dayHours.hours.closed ? (
                    <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                  ) : (
                    <Clock3 className="text-brand mt-px size-3.5 shrink-0" aria-hidden />
                  )}
                  {dayHours.hours.closed ? (
                    <span>The clinic is closed on {dayHours.label}s. Choose another date.</span>
                  ) : (
                    <span>
                      Clinic hours on {dayHours.label}: <strong className="text-navy font-semibold">{formatShifts(dayHours.hours)}</strong>
                    </span>
                  )}
                </p>
              )}
              {duration && (
                <span className="bg-muted text-muted-foreground inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium tabular-nums">
                  <Clock3 className="size-3.5" aria-hidden /> {duration}
                </span>
              )}
            </div>
          </div>

          <div className="border-border/70 flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="lg" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" disabled={isPending} className="min-w-44">
              {isPending ? <Loader2 className="animate-spin" /> : <Check />} {isPending ? "Rescheduling…" : "Reschedule"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
