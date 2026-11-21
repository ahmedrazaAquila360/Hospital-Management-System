"use client";

import { useActionState, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, Check, CircleDollarSign, Flag, NotebookText, Stethoscope, Tag, UserRound, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { PatientCombobox } from "@/components/shared/patient-combobox";
import { IconInput } from "@/components/shared/icon-input";
import { ErrorSummary, RequiredMark, SubmitButton } from "@/components/shared/record-form";
import { ToothIcon } from "@/components/dental-chart/tooth-icon";
import { DentitionToggle, ToothSelector, initialDentition, type Dentition } from "@/components/treatments/tooth-selector";
import { isValidToothNumber } from "@/lib/dental";
import { submitWithoutReset } from "@/lib/form-submit";
import { TREATMENT_STATUSES } from "@/lib/validations/treatment";
import { TREATMENT_STATUS_LABEL } from "@/lib/labels";
import type { TreatmentFormState } from "@/server/treatments/actions";
import type { Patient, Treatment } from "@/generated/prisma/client";

const leadingIcon = "text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2";
const DESCRIPTION_MAX = 500;

function Card({ icon: Icon, title, description, action, children }: { icon: LucideIcon | typeof ToothIcon; title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="bg-pale text-brand flex size-10 shrink-0 items-center justify-center rounded-xl" aria-hidden>
            <Icon className="size-5" />
          </span>
          <div>
            <h2 className="text-navy text-lg font-semibold tracking-tight">{title}</h2>
            {description && <p className="text-muted-foreground text-sm">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * New / Edit Treatment: Patient & Dentist, Treatment Details, Affected Teeth (FDI picker) and
 * Cost & Schedule. Required fields and the date / discount rules are checked in the browser
 * first; the server action validates again and its errors show inline.
 */
export function TreatmentForm({
  action,
  dentists,
  treatment,
  defaultPatient,
  defaultTeeth = [],
  defaultAppointmentId,
  submitLabel = "Create Treatment",
  cancelHref = "/treatments",
}: {
  action: (state: TreatmentFormState, formData: FormData) => Promise<TreatmentFormState>;
  dentists: { id: string; name: string }[];
  treatment?: Treatment;
  defaultPatient?: Patient | null;
  defaultTeeth?: number[];
  defaultAppointmentId?: string;
  submitLabel?: string;
  cancelHref?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [dentistId, setDentistId] = useState(treatment?.dentistId ?? "");
  const [status, setStatus] = useState<string>(treatment?.status ?? "PLANNED");
  // Only valid FDI numbers (a bad ?toothNumber= would otherwise fail server validation).
  const [teeth, setTeeth] = useState<number[]>(() => defaultTeeth.filter(isValidToothNumber));
  const [dentition, setDentition] = useState<Dentition>(() => initialDentition(defaultTeeth.filter(isValidToothNumber)));
  const [descLength, setDescLength] = useState(treatment?.description?.length ?? 0);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const dentistRef = useRef<HTMLButtonElement>(null);
  const err = (field: string) => clientErrors[field] ?? state.fieldErrors?.[field];
  const clearError = (field: string) => setClientErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== field)));

  const submit = submitWithoutReset(formAction);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const next: Record<string, string> = {};
    if (!data.get("patientId")) next.patientId = "Select a patient";
    if (!dentistId) next.dentistId = "Select a dentist";
    if (String(data.get("name") ?? "").trim().length < 2) next.name = "Treatment name is required";
    const cost = Number(data.get("cost"));
    const discount = Number(data.get("discount") || 0);
    if (data.get("cost") === "" || !Number.isFinite(cost) || cost < 0) next.cost = "Enter a cost of $0.00 or more";
    if (!Number.isFinite(discount) || discount < 0) next.discount = "Discount can't be negative";
    else if (Number.isFinite(cost) && discount > cost) next.discount = "Discount can't be more than the cost";
    const start = String(data.get("startDate") ?? "");
    const end = String(data.get("expectedCompletionDate") ?? "");
    if (start && end && end < start) next.expectedCompletionDate = "Expected completion must be on or after the start date";
    setClientErrors(next);
    if (Object.keys(next).length) {
      event.preventDefault();
      const first = event.currentTarget.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]:not([type=hidden])`);
      if (next.dentistId && !next.patientId) dentistRef.current?.focus();
      else first?.focus();
      return;
    }
    submit(event);
  }

  const dateValue = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : undefined);

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="[&>div]:mx-0 [&>div]:mt-0 empty:hidden">
        <ErrorSummary message={state.error} trigger={state} />
      </div>
      {defaultAppointmentId && <input type="hidden" name="appointmentId" value={defaultAppointmentId} />}
      {treatment?.appointmentId && !defaultAppointmentId && <input type="hidden" name="appointmentId" value={treatment.appointmentId} />}
      <input type="hidden" name="dentistId" value={dentistId} />
      <input type="hidden" name="status" value={status} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card icon={UserRound} title="Patient & Dentist">
            <div className="grid gap-5">
              <Field data-invalid={Boolean(err("patientId"))}>
                <FieldLabel>
                  Patient <RequiredMark />
                </FieldLabel>
                <div className="[&_[role=combobox]]:h-11">
                  <PatientCombobox name="patientId" defaultPatient={defaultPatient} onSelect={() => clearError("patientId")} />
                </div>
                <FieldError>{err("patientId")}</FieldError>
              </Field>
              <Field data-invalid={Boolean(err("dentistId"))}>
                <FieldLabel htmlFor="tr-dentist">
                  Dentist <RequiredMark />
                </FieldLabel>
                <div className="relative">
                  <Stethoscope className={leadingIcon} aria-hidden />
                  <Select
                    value={dentistId}
                    onValueChange={(v) => {
                      setDentistId(v);
                      clearError("dentistId");
                    }}
                  >
                    <SelectTrigger ref={dentistRef} id="tr-dentist" className="h-11! w-full pl-10" aria-invalid={Boolean(err("dentistId")) || undefined}>
                      <SelectValue placeholder="Select dentist…" />
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
          </Card>

          <Card icon={NotebookText} title="Treatment Details">
            <div className="grid gap-5">
              <Field data-invalid={Boolean(err("name"))}>
                <FieldLabel htmlFor="tr-name">
                  Treatment Name <RequiredMark />
                </FieldLabel>
                <IconInput
                  icon={<ToothIcon />}
                  id="tr-name"
                  name="name"
                  defaultValue={treatment?.name}
                  placeholder="e.g. Root Canal Therapy"
                  autoComplete="off"
                  aria-invalid={Boolean(err("name")) || undefined}
                  onChange={() => clearError("name")}
                />
                <FieldError>{err("name")}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="tr-description">Description</FieldLabel>
                <Textarea
                  id="tr-description"
                  name="description"
                  rows={5}
                  maxLength={DESCRIPTION_MAX}
                  defaultValue={treatment?.description ?? undefined}
                  onChange={(e) => setDescLength(e.target.value.length)}
                  placeholder="Enter treatment details, notes or plan…"
                />
                <p className="text-muted-foreground text-right text-xs tabular-nums">
                  {descLength} / {DESCRIPTION_MAX}
                </p>
              </Field>
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Card
            icon={ToothIcon}
            title="Affected Teeth"
            description="Select the affected teeth (FDI numbering)."
            action={<DentitionToggle value={dentition} onChange={setDentition} />}
          >
            <ToothSelector selected={teeth} onChange={setTeeth} mode={dentition} />
          </Card>

          <Card icon={CircleDollarSign} title="Cost & Schedule">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={Boolean(err("cost"))}>
                <FieldLabel htmlFor="tr-cost">
                  Cost ($) <RequiredMark />
                </FieldLabel>
                <IconInput
                  icon={<CircleDollarSign />}
                  id="tr-cost"
                  name="cost"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  defaultValue={treatment ? Number(treatment.cost) : undefined}
                  className="tabular-nums"
                  aria-invalid={Boolean(err("cost")) || undefined}
                  onChange={() => clearError("cost")}
                />
                <FieldError>{err("cost")}</FieldError>
              </Field>
              <Field data-invalid={Boolean(err("discount"))}>
                <FieldLabel htmlFor="tr-discount">Discount ($)</FieldLabel>
                <IconInput
                  icon={<Tag />}
                  id="tr-discount"
                  name="discount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  defaultValue={treatment ? Number(treatment.discount) : undefined}
                  className="tabular-nums"
                  aria-invalid={Boolean(err("discount")) || undefined}
                  onChange={() => clearError("discount")}
                />
                <FieldError>{err("discount")}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="tr-start">Start Date</FieldLabel>
                <IconInput icon={<CalendarDays />} id="tr-start" name="startDate" type="date" defaultValue={dateValue(treatment?.startDate)} onChange={() => clearError("expectedCompletionDate")} />
              </Field>
              <Field data-invalid={Boolean(err("expectedCompletionDate"))}>
                <FieldLabel htmlFor="tr-end">Expected Completion</FieldLabel>
                <IconInput
                  icon={<CalendarDays />}
                  id="tr-end"
                  name="expectedCompletionDate"
                  type="date"
                  defaultValue={dateValue(treatment?.expectedCompletionDate)}
                  aria-invalid={Boolean(err("expectedCompletionDate")) || undefined}
                  onChange={() => clearError("expectedCompletionDate")}
                />
                <FieldError>{err("expectedCompletionDate")}</FieldError>
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="tr-status">
                  Status <RequiredMark />
                </FieldLabel>
                <div className="relative">
                  <Flag className={leadingIcon} aria-hidden />
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger id="tr-status" className="h-11! w-full pl-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TREATMENT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {TREATMENT_STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Field>
            </div>
          </Card>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="outline" size="lg">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <SubmitButton label={submitLabel} icon={<Check />} />
      </div>
    </form>
  );
}
