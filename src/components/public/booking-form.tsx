"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitWithoutReset } from "@/lib/form-submit";
import { CalendarCheck2, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { createAppointmentRequestAction } from "@/server/public/actions";
import { PREFERRED_TIME_LABEL } from "@/lib/validations/appointment-request";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="bg-brand-gradient h-12 w-full rounded-full text-base shadow-glow" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Sending…
        </>
      ) : (
        <>
          <CalendarCheck2 /> Request Appointment
        </>
      )}
    </Button>
  );
}

export function BookingForm({ dentists }: { dentists: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState(createAppointmentRequestAction, {});

  const today = new Date().toISOString().slice(0, 10);

  if (state.success) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[28px] border border-[#e3edf6] bg-white p-10 text-center shadow-[0_30px_60px_-36px_rgb(8_44_86/0.5)]">
        <span className="text-success flex size-16 items-center justify-center rounded-full bg-[#e7f6ef] ring-8 ring-[#e7f6ef]/50">
          <MailCheck className="size-7" />
        </span>
        <h2 className="text-navy mt-2 text-2xl font-semibold tracking-tight">Request received</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          Thanks — our front desk will reach out shortly to confirm your appointment time.
        </p>
        <Button asChild variant="outline" size="lg" className="mt-2 rounded-full">
          <a href="/">Back to Home</a>
        </Button>
      </div>
    );
  }

  return (
    <form
      action={formAction} onSubmit={submitWithoutReset(formAction)}
      className="flex flex-col gap-5 rounded-[28px] border border-[#e3edf6] bg-white p-6 shadow-[0_30px_60px_-36px_rgb(8_44_86/0.5)] sm:p-9 [&_[data-slot=input]]:h-11 [&_[data-slot=input]]:rounded-xl [&_[data-slot=select-trigger]]:h-11! [&_[data-slot=select-trigger]]:rounded-xl [&_[data-slot=textarea]]:rounded-xl"
    >
      {state.error && (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-2.5 text-sm">
          {state.error}
        </div>
      )}

      {/* Honeypot — hidden from real visitors, catches simple bots. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <FieldGroup>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="fullName">Full Name</FieldLabel>
            <Input id="fullName" name="fullName" placeholder="Jane Doe" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <Input id="phone" name="phone" type="tel" placeholder="+1 (555) 000-0000" required />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="email">Email (optional)</FieldLabel>
          <Input id="email" name="email" type="email" placeholder="you@example.com" />
        </Field>

        <Field>
          <FieldLabel htmlFor="preferredDentistId">Preferred Dentist (optional)</FieldLabel>
          <Select name="preferredDentistId">
            <SelectTrigger id="preferredDentistId" className="w-full">
              <SelectValue placeholder="No preference" />
            </SelectTrigger>
            <SelectContent>
              {dentists.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="preferredDate">Preferred Date</FieldLabel>
            <Input id="preferredDate" name="preferredDate" type="date" min={today} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="preferredTime">Preferred Time</FieldLabel>
            <Select name="preferredTime" defaultValue="MORNING">
              <SelectTrigger id="preferredTime" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PREFERRED_TIME_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="reason">Reason for visit (optional)</FieldLabel>
          <Textarea id="reason" name="reason" rows={3} placeholder="e.g. Toothache, routine cleaning, consultation…" />
          <FieldError>{state.error}</FieldError>
        </Field>
      </FieldGroup>

      <SubmitButton />
      <p className="text-muted-foreground text-center text-xs">
        This sends a request to our front desk — we&apos;ll confirm your exact appointment time by phone or email.
      </p>
    </form>
  );
}
