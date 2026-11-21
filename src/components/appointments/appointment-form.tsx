"use client";

import { useActionState, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { CalendarCheck, CalendarDays, Check, Clock3, NotebookPen, Stethoscope, TriangleAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { PatientCombobox } from "@/components/shared/patient-combobox";
import { IconInput } from "@/components/shared/icon-input";
import { ErrorSummary, FormSection, RequiredMark, SubmitButton } from "@/components/shared/record-form";
import { ToothIcon } from "@/components/dental-chart/tooth-icon";
import { submitWithoutReset } from "@/lib/form-submit";
import { cn } from "@/lib/utils";
import { APPOINTMENT_TYPES } from "@/lib/validations/appointment";
import { APPOINTMENT_TYPE_LABEL } from "@/lib/labels";
import type { AppointmentFormState } from "@/server/appointments/actions";
import type { Appointment, Patient } from "@/generated/prisma/client";
import type { SafeUser } from "@/lib/safe-user";
import { dayFor, formatShifts, workingHoursProblem, type WorkingHours } from "@/lib/working-hours";

const leadingIcon = "text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2";

export function AppointmentForm({
  action,
  dentists,
  appointment,
  defaultPatient,
  defaultDate,
  followUp,
  defaultStartTime = "09:00",
  defaultEndTime = "09:30",
  submitLabel = "Book Appointment",
  workingHours = null,
}: {
  action: (state: AppointmentFormState, formData: FormData) => Promise<AppointmentFormState>;
  dentists: Pick<SafeUser, "id" | "name">[];
  appointment?: Appointment;
  defaultPatient?: Patient | null;
  defaultDate?: string;
  followUp?: boolean;
  /**
   * HH:mm, worked out on the server. Times are saved with the server's clock, so reading them
   * back in the browser with toISOString (UTC) showed — and re-saved — the wrong time.
   */
  defaultStartTime?: string;
  defaultEndTime?: string;
  submitLabel?: string;
  /** Clinic hours from Settings; the form shows the chosen day's shifts and checks the times. */
  workingHours?: WorkingHours | null;
}) {
  const [state, formAction] = useActionState(action, {});
  const [dentistId, setDentistId] = useState(appointment?.dentistId ?? "");
  const [type, setType] = useState<string>(appointment?.type ?? (followUp ? "FOLLOW_UP" : "CONSULTATION"));
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const dentistRef = useRef<HTMLButtonElement>(null);
  const isEdit = Boolean(appointment);
  const initialDate = appointment ? appointment.date.toISOString().slice(0, 10) : (defaultDate ?? "");
  const [date, setDate] = useState(initialDate);
  const dayHours = workingHours && date ? dayFor(workingHours, date) : null;
  const err = (field: string) => clientErrors[field] ?? state.fieldErrors?.[field];
  const clearError = (field: string) =>
    setClientErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== field)));

  // Same rules as the server schema, checked before sending so the message appears at once.
  const submit = submitWithoutReset(formAction);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const next: Record<string, string> = {};
    if (!new FormData(form).get("patientId")) next.patientId = "Select a patient";
    if (!dentistId) next.dentistId = "Select a dentist";
    const start = startRef.current?.value ?? "";
    const end = endRef.current?.value ?? "";
    if (start && end && end <= start) next.endTime = "End time must be after start time";
    else {
      // Same rule as the server: the visit must fit inside one of the day's shifts.
      const outside = workingHoursProblem(workingHours, date, start, end);
      if (outside && !(isEdit && date === initialDate && start === defaultStartTime && end === defaultEndTime)) next.startTime = outside;
    }
    setClientErrors(next);
    if (Object.keys(next).length) {
      event.preventDefault();
      if (next.dentistId) dentistRef.current?.focus();
      else if (next.endTime) endRef.current?.focus();
      else if (next.startTime) startRef.current?.focus();
      return;
    }
    submit(event);
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="surface-card @container overflow-hidden p-0">
      <ErrorSummary message={state.error} trigger={state} />

      <FormSection icon={Users} title="Appointment Details">
        <div className="grid grid-cols-1 gap-5 @xl:grid-cols-2">
          <Field data-invalid={Boolean(err("patientId"))}>
            <FieldLabel>
              Patient <RequiredMark />
            </FieldLabel>
            <div className="[&_[role=combobox]]:h-11">
              <PatientCombobox
                name="patientId"
                defaultPatient={defaultPatient}
                onSelect={() => clearError("patientId")}
              />
            </div>
            <FieldError>{err("patientId")}</FieldError>
          </Field>

          <Field data-invalid={Boolean(err("dentistId"))}>
            <FieldLabel htmlFor="appt-dentist">
              Dentist <RequiredMark />
            </FieldLabel>
            <input type="hidden" name="dentistId" value={dentistId} />
            <div className="relative">
              <Stethoscope className={leadingIcon} aria-hidden />
              <Select
                value={dentistId}
                onValueChange={(v) => {
                  setDentistId(v);
                  clearError("dentistId");
                }}
              >
                <SelectTrigger ref={dentistRef} id="appt-dentist" className="h-11! w-full pl-10" aria-invalid={Boolean(err("dentistId")) || undefined}>
                  <SelectValue placeholder="Select dentist" />
                </SelectTrigger>
                <SelectContent>
                  {dentists.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FieldError>{err("dentistId")}</FieldError>
          </Field>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 @xl:grid-cols-3">
          <Field data-invalid={Boolean(err("date"))}>
            <FieldLabel htmlFor="appt-date">
              Date <RequiredMark />
            </FieldLabel>
            <IconInput
              icon={<CalendarDays />}
              id="appt-date"
              name="date"
              type="date"
              defaultValue={initialDate}
              onChange={(e) => {
                setDate(e.target.value);
                clearError("startTime");
              }}
              required
            />
            <FieldError>{err("date")}</FieldError>
          </Field>
          <Field data-invalid={Boolean(err("startTime"))}>
            <FieldLabel htmlFor="appt-start">
              Start Time <RequiredMark />
            </FieldLabel>
            <IconInput ref={startRef} icon={<Clock3 />} id="appt-start" name="startTime" type="time" defaultValue={defaultStartTime} onChange={() => clearError("startTime")} required />
            <FieldError>{err("startTime")}</FieldError>
          </Field>
          <Field data-invalid={Boolean(err("endTime"))}>
            <FieldLabel htmlFor="appt-end">
              End Time <RequiredMark />
            </FieldLabel>
            <IconInput
              ref={endRef}
              icon={<Clock3 />}
              id="appt-end"
              name="endTime"
              type="time"
              defaultValue={defaultEndTime}
              required
              aria-invalid={Boolean(err("endTime")) || undefined}
              onChange={() => clearError("endTime")}
            />
            <FieldError>{err("endTime")}</FieldError>
          </Field>
        </div>

        {dayHours && (
          <p
            className={cn(
              "mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs",
              dayHours.hours.closed ? "bg-destructive/5 text-destructive" : "bg-pale/60 text-foreground/80"
            )}
          >
            {dayHours.hours.closed ? <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden /> : <Clock3 className="text-brand mt-px size-3.5 shrink-0" aria-hidden />}
            {dayHours.hours.closed ? (
              <span>The clinic is closed on {dayHours.label}s. Choose another date.</span>
            ) : (
              <span>
                Clinic hours on {dayHours.label}: <strong className="text-navy font-semibold">{formatShifts(dayHours.hours)}</strong>
              </span>
            )}
          </p>
        )}

        <Field className="mt-5" data-invalid={Boolean(err("type"))}>
          <FieldLabel htmlFor="appt-type">
            Appointment Type <RequiredMark />
          </FieldLabel>
          <input type="hidden" name="type" value={type} />
          <div className="relative">
            <ToothIcon className={leadingIcon} />
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="appt-type" className="h-11! w-full pl-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPOINTMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {APPOINTMENT_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <FieldError>{err("type")}</FieldError>
        </Field>
      </FormSection>

      <FormSection icon={NotebookPen} title="Notes">
        <Field>
          <FieldLabel htmlFor="appt-notes" className="sr-only">
            Notes
          </FieldLabel>
          <Textarea
            id="appt-notes"
            name="notes"
            rows={4}
            defaultValue={appointment?.notes ?? undefined}
            placeholder="Add any additional notes (optional)…"
          />
        </Field>
      </FormSection>

      <div className="border-border/70 bg-muted/30 flex gap-3 border-t px-5 py-4 sm:justify-end sm:px-7">
        <Button asChild variant="outline" size="lg" className="flex-1 sm:flex-none">
          <Link href={appointment ? `/appointments/${appointment.id}` : "/appointments"}>Cancel</Link>
        </Button>
        {!isEdit && <><label className="flex items-center gap-2"><input type="checkbox" name="walkIn" /> Check in walk-in now</label><label className="flex items-center gap-2"><input type="checkbox" name="emergency" /> Emergency visit</label></>}
        <SubmitButton label={submitLabel} icon={isEdit ? <Check /> : <CalendarCheck />} />
      </div>
    </form>
  );
}
