"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { FileText, Pill, Plus, Save, Stethoscope, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { PatientCombobox } from "@/components/shared/patient-combobox";
import { ErrorSummary, FormSection, RequiredMark, SubmitButton } from "@/components/shared/record-form";
import { submitWithoutReset } from "@/lib/form-submit";
import type { PrescriptionFormState } from "@/server/prescriptions/actions";
import type { Patient } from "@/generated/prisma/client";
import type { SafeUser } from "@/lib/safe-user";

// Suggestions only (native datalist): the fields stay free text, as the server expects.
const FREQUENCIES = ["Once daily", "Twice daily", "3x daily", "4x daily", "Every 8 hours", "As needed", "At bedtime"];
const DURATIONS = ["1 day", "3 days", "5 days", "7 days", "10 days", "14 days", "1 month"];

type MedicineRow = { key: number };

export function PrescriptionForm({
  action,
  dentists,
  defaultPatient,
  medicineOptions,
  defaultEncounterId,
  defaultAppointmentId,
}: {
  action: (state: PrescriptionFormState, formData: FormData) => Promise<PrescriptionFormState>;
  dentists: Pick<SafeUser, "id" | "name">[];
  defaultPatient?: Patient | null;
  medicineOptions: string[];
  defaultEncounterId?: string;
  defaultAppointmentId?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [rows, setRows] = useState<MedicineRow[]>([{ key: 0 }]);
  const nextKey = useRef(1);
  const [dentistId, setDentistId] = useState("");
  const [missing, setMissing] = useState<{ patient?: boolean; dentist?: boolean }>({});
  const dentistRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const focusKey = useRef<number | null>(null);
  // Focus a newly added medicine's name once it has rendered.
  useEffect(() => {
    if (focusKey.current === null) return;
    listRef.current?.querySelector<HTMLInputElement>(`#med-${focusKey.current}-name`)?.focus();
    focusKey.current = null;
  }, [rows]);

  function addRow() {
    const key = nextKey.current++;
    focusKey.current = key;
    setRows((r) => [...r, { key }]);
  }
  function removeRow(key: number) {
    setRows((r) => (r.length > 1 ? r.filter((row) => row.key !== key) : r));
  }

  const submit = submitWithoutReset(formAction);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const next = {
      patient: !new FormData(event.currentTarget).get("patientId"),
      dentist: !dentistId,
    };
    setMissing(next);
    if (next.patient || next.dentist) {
      event.preventDefault();
      if (next.dentist) dentistRef.current?.focus();
      return;
    }
    submit(event);
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-6">
      {defaultEncounterId && <input type="hidden" name="encounterId" value={defaultEncounterId} />}
      {defaultAppointmentId && <input type="hidden" name="appointmentId" value={defaultAppointmentId} />}

      <div className="surface-card @container overflow-hidden p-0">
        {state.allergies && <label className="block p-4 text-destructive"><input type="checkbox" name="reviewedAllergies" value={state.allergies} required /> I reviewed the recorded allergies · {state.allergies}</label>}
        {state.reviewToken && <div className="space-y-2 p-4"><ul className="list-disc pl-5">{state.medicationWarnings?.map((w,i)=><li key={i}>{w}</li>)}</ul><label><input type="checkbox" name="medicationReview" value={state.reviewToken} required/> I reviewed these checks and the prescribed regimen.</label></div>}
        <ErrorSummary message={state.error} trigger={state} />
        <FormSection icon={UserRound} title="Patient & Provider">
          <div className="grid grid-cols-1 gap-5 @xl:grid-cols-2">
            <Field data-invalid={missing.patient || undefined}>
              <FieldLabel>
                Patient <RequiredMark />
              </FieldLabel>
              <div className="[&_[role=combobox]]:h-11">
                <PatientCombobox name="patientId" defaultPatient={defaultPatient} onSelect={() => setMissing((m) => ({ ...m, patient: false }))} />
              </div>
              <FieldError>{missing.patient ? "Select a patient" : undefined}</FieldError>
            </Field>
            <Field data-invalid={missing.dentist || undefined}>
              <FieldLabel htmlFor="rx-dentist">
                Doctor <RequiredMark />
              </FieldLabel>
              <input type="hidden" name="dentistId" value={dentistId} />
              <div className="relative">
                <Stethoscope className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2" aria-hidden />
                <Select
                  value={dentistId}
                  onValueChange={(v) => {
                    setDentistId(v);
                    setMissing((m) => ({ ...m, dentist: false }));
                  }}
                >
                  <SelectTrigger ref={dentistRef} id="rx-dentist" className="h-11! w-full pl-10" aria-invalid={missing.dentist || undefined}>
                    <SelectValue placeholder="Select doctor" />
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
              <FieldError>{missing.dentist ? "Select a doctor" : undefined}</FieldError>
            </Field>
          </div>
        </FormSection>
      </div>

      <div className="surface-card @container overflow-hidden p-0">
        <section className="px-5 py-6 sm:px-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="text-navy flex items-center gap-2.5 text-lg font-semibold tracking-tight">
              <Pill className="text-brand size-5" aria-hidden /> Medicines
              <span className="bg-pale text-navy rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums">{rows.length}</span>
            </h3>
            <Button type="button" variant="outline" onClick={addRow}>
              <Plus /> Add Medicine
            </Button>
          </div>

          <div ref={listRef} className="flex flex-col gap-4">
            {rows.map((row, i) => (
              <fieldset key={row.key} className="border-border/80 bg-muted/20 overflow-hidden rounded-2xl border">
                <legend className="sr-only">Medicine {i + 1}</legend>
                <div className="bg-pale/50 border-border/70 flex items-center justify-between border-b px-4 py-2.5">
                  <p className="text-navy flex items-center gap-2 text-sm font-semibold" aria-hidden>
                    <span className="bg-card text-brand flex size-6 items-center justify-center rounded-lg text-xs shadow-xs">{i + 1}</span>
                    Medicine {i + 1}
                  </p>
                  {rows.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 size-8"
                      onClick={() => removeRow(row.key)}
                      aria-label={`Remove medicine ${i + 1}`}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 p-4 @xl:grid-cols-2 @4xl:grid-cols-4">
                  <Field>
                    <FieldLabel htmlFor={`med-${row.key}-name`}>
                      Medicine Name <RequiredMark />
                    </FieldLabel>
                    <Input id={`med-${row.key}-name`} name="medicineName" list="hospital-medicines" placeholder="e.g. Amoxicillin" className="h-11 bg-card" autoComplete="off" required />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`med-${row.key}-dosage`}>
                      Dosage <RequiredMark />
                    </FieldLabel>
                    <Input id={`med-${row.key}-dosage`} name="dosage" placeholder="e.g. 500mg" className="h-11 bg-card" autoComplete="off" required />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`med-${row.key}-frequency`}>
                      Frequency <RequiredMark />
                    </FieldLabel>
                    <Input id={`med-${row.key}-frequency`} name="frequency" list="rx-frequencies" placeholder="e.g. 3x daily" className="h-11 bg-card" autoComplete="off" required />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`med-${row.key}-duration`}>
                      Duration <RequiredMark />
                    </FieldLabel>
                    <Input id={`med-${row.key}-duration`} name="duration" list="rx-durations" placeholder="e.g. 5 days" className="h-11 bg-card" autoComplete="off" required />
                  </Field>
                  <Field><FieldLabel htmlFor={`route-${row.key}`}>Route</FieldLabel><Input id={`route-${row.key}`} name="route" maxLength={100}/></Field>
                  <Field className="@xl:col-span-2 @4xl:col-span-4">
                    <FieldLabel htmlFor={`med-${row.key}-instructions`}>Instructions</FieldLabel>
                    <Input id={`med-${row.key}-instructions`} name="medicineInstructions" placeholder="e.g. Take after meals" className="h-11 bg-card" autoComplete="off" />
                  </Field>
                </div>
              </fieldset>
            ))}
          </div>
          <datalist id="hospital-medicines">{medicineOptions.map(n => <option key={n} value={n}/>)}</datalist>
          <datalist id="rx-frequencies">
            {FREQUENCIES.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <datalist id="rx-durations">
            {DURATIONS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </section>
      </div>

      <div className="surface-card overflow-hidden p-0">
        <FormSection icon={FileText} title="General Instructions">
          <Field>
            <FieldLabel htmlFor="rx-instructions" className="sr-only">
              General instructions
            </FieldLabel>
            <Textarea id="rx-instructions" name="instructions" rows={3} placeholder="Additional notes for the patient…" />
          </Field>
        </FormSection>
        <div className="border-border/70 bg-muted/30 flex gap-3 border-t px-5 py-4 sm:justify-end sm:px-7">
          <Button asChild variant="outline" size="lg" className="flex-1 sm:flex-none">
            <Link href="/prescriptions">Cancel</Link>
          </Button>
          <SubmitButton label="Save Prescription" icon={<Save />} />
        </div>
      </div>
    </form>
  );
}
