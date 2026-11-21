"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  CircleCheck,
  ClipboardList,
  Contact,
  Droplet,
  HeartPulse,
  Mail,
  MapPin,
  Phone,
  PhoneCall,
  Pill,
  ShieldAlert,
  UserPlus,
  UserRound,
  VenusAndMars,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { IconInput } from "@/components/shared/icon-input";
import {
  ErrorSummary,
  FormSection,
  PhotoUploadField,
  RequiredMark,
  SubmitButton,
  localToday,
} from "@/components/shared/record-form";
import { submitWithoutReset } from "@/lib/form-submit";
import { BLOOD_GROUP_OPTIONS, GENDER_OPTIONS } from "@/lib/validations/patient";
import type { PatientFormState } from "@/server/patients/actions";
import type { Patient, MedicalHistory } from "@/generated/prisma/client";

const CONDITIONS = [
  ["hasDiabetes", "Diabetes"],
  ["hasHypertension", "Hypertension"],
  ["hasHeartCondition", "Heart Condition"],
  ["hasBleedingDisorder", "Bleeding Disorder"],
  ["isPregnant", "Pregnant"],
  ["isSmoker", "Smoker"],
] as const;

const RECORD_INCLUDES = [
  "Dental chart, conditions and clinical notes",
  "Treatments, appointments and prescriptions",
  "Invoices and payment history",
];

const leadingIcon = "text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2";

/** One white card per section, as in the reference layout. */
function SectionCard({ children }: { children: ReactNode }) {
  return <div className="surface-card @container min-w-0 overflow-hidden">{children}</div>;
}

export function PatientForm({
  action,
  patient,
  medicalHistory,
  submitLabel = "Add Patient",
  defaultFullName,
  defaultPhone,
}: {
  action: (state: PatientFormState, formData: FormData) => Promise<PatientFormState>;
  patient?: Patient;
  medicalHistory?: MedicalHistory | null;
  submitLabel?: string;
  defaultFullName?: string;
  defaultPhone?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [fullName, setFullName] = useState(patient?.fullName ?? defaultFullName ?? "");
  // Selects are controlled and submitted through hidden inputs (see submitWithoutReset).
  const [gender, setGender] = useState<string>(patient?.gender ?? "");
  const [bloodGroup, setBloodGroup] = useState<string>(patient?.bloodGroup ?? "");
  const [genderMissing, setGenderMissing] = useState(false);
  const genderTriggerRef = useRef<HTMLButtonElement>(null);
  const dobRef = useRef<HTMLInputElement>(null);
  const isEdit = Boolean(patient);
  const err = (field: string) => state.fieldErrors?.[field];
  // The server's enum message lists raw keys ("MALE"|"FEMALE"…); show something readable.
  const genderError = genderMissing || err("gender") ? "Select a gender." : undefined;

  // No birth dates in the future. Set after hydration: "today" depends on the browser's zone.
  useEffect(() => {
    dobRef.current?.setAttribute("max", localToday());
  }, []);

  const submit = submitWithoutReset(formAction);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!gender) {
      event.preventDefault();
      setGenderMissing(true);
      genderTriggerRef.current?.focus();
      return;
    }
    submit(event);
  }

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      className="grid items-start gap-6 xl:grid-cols-[19rem_minmax(0,1fr)] 2xl:grid-cols-[22rem_minmax(0,1fr)]"
    >
      <aside className="surface-card flex flex-col gap-5 p-5 sm:p-6 xl:sticky xl:top-24">
        <PhotoUploadField
          inputName="photo"
          currentUrl={patient?.photoUrl ?? null}
          displayName={fullName}
          description={isEdit ? "Update the patient's photo." : "Upload a clear photo for the patient."}
          fallbackIcon={isEdit ? UserRound : UserPlus}
        />
        <div className="bg-pale/70 hidden rounded-2xl p-4 xl:block">
          <p className="text-navy flex items-center gap-2 text-sm font-semibold">
            <HeartPulse className="text-brand size-4.5" aria-hidden /> Patient Record
          </p>
          <p className="text-muted-foreground mt-1.5 text-xs">Everything for this patient is kept together:</p>
          <ul className="mt-3 space-y-2">
            {RECORD_INCLUDES.map((item) => (
              <li key={item} className="text-foreground/80 flex items-start gap-2 text-xs leading-snug">
                <CircleCheck className="text-brand mt-px size-3.5 shrink-0" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        <SectionCard>
          <ErrorSummary message={state.error} trigger={state} />
          <FormSection icon={UserRound} title="Personal Information">
            <div className="grid grid-cols-1 gap-5 @xl:grid-cols-2">
              <Field data-invalid={Boolean(err("fullName"))}>
                <FieldLabel htmlFor="patient-name">
                  Full Name <RequiredMark />
                </FieldLabel>
                <IconInput
                  icon={<UserRound />}
                  id="patient-name"
                  name="fullName"
                  defaultValue={patient?.fullName ?? defaultFullName}
                  placeholder="Enter full name"
                  autoComplete="off"
                  minLength={2}
                  required
                  aria-invalid={Boolean(err("fullName")) || undefined}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <FieldError>{err("fullName")}</FieldError>
              </Field>
              <Field data-invalid={Boolean(err("dob"))}>
                <FieldLabel htmlFor="patient-dob">
                  Date of Birth <RequiredMark />
                </FieldLabel>
                <IconInput
                  ref={dobRef}
                  icon={<CalendarDays />}
                  id="patient-dob"
                  name="dob"
                  type="date"
                  defaultValue={patient ? new Date(patient.dob).toISOString().slice(0, 10) : undefined}
                  required
                  aria-invalid={Boolean(err("dob")) || undefined}
                />
                <FieldError>{err("dob")}</FieldError>
              </Field>
              <Field data-invalid={Boolean(genderError)}>
                <FieldLabel htmlFor="patient-gender">
                  Gender <RequiredMark />
                </FieldLabel>
                <input type="hidden" name="gender" value={gender} />
                <div className="relative">
                  <VenusAndMars className={leadingIcon} aria-hidden />
                  <Select
                    value={gender}
                    onValueChange={(v) => {
                      setGender(v);
                      setGenderMissing(false);
                    }}
                  >
                    <SelectTrigger
                      ref={genderTriggerRef}
                      id="patient-gender"
                      className="h-11! w-full pl-10"
                      aria-invalid={Boolean(genderError) || undefined}
                    >
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <FieldError>{genderError}</FieldError>
              </Field>
              <Field data-invalid={Boolean(err("bloodGroup"))}>
                <FieldLabel htmlFor="patient-blood">Blood Group</FieldLabel>
                <input type="hidden" name="bloodGroup" value={bloodGroup} />
                <div className="relative">
                  <Droplet className={leadingIcon} aria-hidden />
                  <Select value={bloodGroup} onValueChange={setBloodGroup}>
                    <SelectTrigger id="patient-blood" className="h-11! w-full pl-10">
                      <SelectValue placeholder="Select blood group" />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOOD_GROUP_OPTIONS.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <FieldError>{err("bloodGroup")}</FieldError>
              </Field>
            </div>
          </FormSection>
        </SectionCard>

        <SectionCard>
          <FormSection icon={PhoneCall} title="Contact & Emergency">
            <div className="grid grid-cols-1 gap-5 @xl:grid-cols-2">
              <Field data-invalid={Boolean(err("phone"))}>
                <FieldLabel htmlFor="patient-phone">
                  Phone <RequiredMark />
                </FieldLabel>
                {/* minLength mirrors the server rule (7+ characters). autoComplete is off on
                    patient fields so the browser doesn't offer the signed-in user's own details. */}
                <IconInput
                  icon={<Phone />}
                  id="patient-phone"
                  name="phone"
                  type="tel"
                  defaultValue={patient?.phone ?? defaultPhone}
                  placeholder="Enter phone number"
                  autoComplete="off"
                  minLength={7}
                  required
                  aria-invalid={Boolean(err("phone")) || undefined}
                />
                <FieldError>{err("phone")}</FieldError>
              </Field>
              <Field data-invalid={Boolean(err("email"))}>
                <FieldLabel htmlFor="patient-email">Email</FieldLabel>
                <IconInput
                  icon={<Mail />}
                  id="patient-email"
                  name="email"
                  type="email"
                  defaultValue={patient?.email ?? undefined}
                  placeholder="Enter email address"
                  autoComplete="off"
                  aria-invalid={Boolean(err("email")) || undefined}
                />
                <FieldError>{err("email")}</FieldError>
              </Field>
              <Field className="@xl:col-span-2">
                <FieldLabel htmlFor="patient-address">Address</FieldLabel>
                <div className="relative">
                  <MapPin className="text-muted-foreground pointer-events-none absolute top-3 left-3 size-4" aria-hidden />
                  <Textarea
                    id="patient-address"
                    name="address"
                    rows={2}
                    defaultValue={patient?.address ?? undefined}
                    placeholder="Enter full address"
                    autoComplete="off"
                    className="min-h-20 pl-10"
                  />
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="patient-emergency-name">Emergency Contact Name</FieldLabel>
                <IconInput
                  icon={<Contact />}
                  id="patient-emergency-name"
                  name="emergencyContactName"
                  defaultValue={patient?.emergencyContactName ?? undefined}
                  placeholder="Enter contact name"
                  autoComplete="off"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="patient-emergency-phone">Emergency Contact Phone</FieldLabel>
                <IconInput
                  icon={<Phone />}
                  id="patient-emergency-phone"
                  name="emergencyContactPhone"
                  type="tel"
                  defaultValue={patient?.emergencyContactPhone ?? undefined}
                  placeholder="Enter contact phone number"
                  autoComplete="off"
                />
              </Field>
            </div>
          </FormSection>
        </SectionCard>

        <SectionCard>
          <FormSection icon={HeartPulse} title="Medical History">
            <div className="grid grid-cols-1 gap-5 @xl:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="patient-allergies">Allergies</FieldLabel>
                <IconInput
                  icon={<ShieldAlert />}
                  id="patient-allergies"
                  name="allergies"
                  placeholder="e.g. Penicillin, Latex"
                  defaultValue={patient?.allergies ?? undefined}
                  autoComplete="off"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="patient-medications">Current Medications</FieldLabel>
                <IconInput
                  icon={<Pill />}
                  id="patient-medications"
                  name="currentMedications"
                  placeholder="e.g. Metformin 500 mg"
                  defaultValue={patient?.currentMedications ?? undefined}
                  autoComplete="off"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="surgical-history">Surgical history</FieldLabel>
                <Textarea id="surgical-history" name="surgicalHistory" maxLength={4000} defaultValue={patient?.surgicalHistory ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="insurance-info">Insurance provider and policy details</FieldLabel>
                <Textarea id="insurance-info" name="insuranceInfo" maxLength={1000} defaultValue={patient?.insuranceInfo ?? ""} />
              </Field>
              <fieldset className="@xl:col-span-2">
                <legend className="text-sm font-medium">Conditions</legend>
                <p className="text-muted-foreground mt-0.5 text-xs">Tick everything that applies.</p>
                <div className="mt-3 grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 @2xl:grid-cols-3">
                  {CONDITIONS.map(([key, label]) => (
                    <label
                      key={key}
                      htmlFor={`patient-${key}`}
                      className="border-border hover:border-brand/40 has-data-[state=checked]:border-brand/50 has-data-[state=checked]:bg-pale/70 flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors"
                    >
                      <Checkbox id={`patient-${key}`} name={key} defaultChecked={medicalHistory?.[key] ?? false} />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <Field>
                <FieldLabel htmlFor="patient-other-conditions">Other Conditions</FieldLabel>
                <Textarea
                  id="patient-other-conditions"
                  name="otherConditions"
                  rows={3}
                  defaultValue={medicalHistory?.otherConditions ?? undefined}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="patient-dental-history">Previous Dental History</FieldLabel>
                <Textarea
                  id="patient-dental-history"
                  name="previousDentalHistory"
                  rows={3}
                  defaultValue={medicalHistory?.previousDentalHistory ?? undefined}
                />
                <FieldDescription className="text-xs">Past procedures, surgeries, or ongoing dental concerns.</FieldDescription>
              </Field>
              <Field className="@xl:col-span-2">
                <FieldLabel htmlFor="patient-notes" className="flex items-center gap-1.5">
                  <ClipboardList className="text-muted-foreground size-4" aria-hidden /> Notes
                </FieldLabel>
                <Textarea id="patient-notes" name="notes" rows={3} defaultValue={patient?.notes ?? undefined} />
              </Field>
            </div>
          </FormSection>

          <div className="border-border/70 bg-muted/30 flex gap-3 border-t px-5 py-4 sm:justify-end sm:px-7">
            <Button asChild variant="outline" size="lg" className="flex-1 sm:flex-none">
              <Link href={patient ? `/patients/${patient.id}` : "/patients"}>Cancel</Link>
            </Button>
            <SubmitButton label={submitLabel} icon={isEdit ? <Check /> : <UserPlus />} />
          </div>
        </SectionCard>
      </div>
    </form>
  );
}
