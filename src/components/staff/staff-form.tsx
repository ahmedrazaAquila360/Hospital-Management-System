"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserCog,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { IconInput, PasswordInput } from "@/components/shared/icon-input";
import {
  ErrorSummary,
  FormSection,
  PhotoUploadField,
  RequiredMark,
  SubmitButton,
  localToday,
} from "@/components/shared/record-form";
import { submitWithoutReset } from "@/lib/form-submit";
import type { StaffFormState } from "@/server/staff/actions";
import type { Role } from "@/generated/prisma/client";
import type { SafeUser } from "@/lib/safe-user";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  DENTIST: "Dentist",
  RECEPTIONIST: "Receptionist",
  STAFF: "Staff",
};

export function StaffForm({
  action,
  roles,
  user,
  submitLabel = "Add Staff Member",
  requirePassword = false,
}: {
  action: (state: StaffFormState, formData: FormData) => Promise<StaffFormState>;
  roles: Role[];
  user?: SafeUser & { role: Role };
  submitLabel?: string;
  requirePassword?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const [name, setName] = useState(user?.name ?? "");
  const [role, setRole] = useState(user?.role.name ?? "");
  const [roleMissing, setRoleMissing] = useState(false);
  const roleTriggerRef = useRef<HTMLButtonElement>(null);
  const joiningRef = useRef<HTMLInputElement>(null);
  const isEdit = Boolean(user);
  const err = (field: string) => state.fieldErrors?.[field];
  // The server's enum message lists raw role keys; show something a person can act on.
  const roleError = roleMissing || err("role") ? "Select a role." : undefined;

  // New staff default to today's date in the user's own time zone. Set after hydration:
  // the server can't know it, and toISOString() gave yesterday's date for timezones ahead of UTC.
  useEffect(() => {
    if (!isEdit && joiningRef.current && !joiningRef.current.value) joiningRef.current.value = localToday();
  }, [isEdit]);

  const submit = submitWithoutReset(formAction);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!role) {
      event.preventDefault();
      setRoleMissing(true);
      roleTriggerRef.current?.focus();
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
          inputName="avatar"
          currentUrl={user?.avatarUrl ?? null}
          displayName={name}
          description={isEdit ? "Update the staff member's profile photo." : "Upload a profile photo for the staff member."}
        />
        <div className="bg-pale/70 hidden gap-3 rounded-2xl p-4 xl:flex">
          <Users className="text-brand mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="text-navy text-sm font-semibold">Staff Account</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              {isEdit
                ? "Their role decides which parts of DentalHub they can use."
                : "The staff member gets their own login, with the role and permissions you assign."}
            </p>
          </div>
        </div>
      </aside>

      <div className="surface-card @container min-w-0 overflow-hidden">
        <ErrorSummary message={state.error} trigger={state} />

        <FormSection icon={UserRound} title="Staff Information">
          <div className="grid grid-cols-1 gap-5 @xl:grid-cols-2">
            <Field data-invalid={Boolean(err("name"))}>
              <FieldLabel htmlFor="staff-name">
                Full Name <RequiredMark />
              </FieldLabel>
              <IconInput
                icon={<UserRound />}
                id="staff-name"
                name="name"
                defaultValue={user?.name}
                placeholder="Enter full name"
                autoComplete="off"
                minLength={2}
                required
                aria-invalid={Boolean(err("name")) || undefined}
                onChange={(e) => setName(e.target.value)}
              />
              <FieldError>{err("name")}</FieldError>
            </Field>
            <Field data-invalid={Boolean(err("email"))}>
              <FieldLabel htmlFor="staff-email">
                Email <RequiredMark />
              </FieldLabel>
              {/* autoComplete off: browsers otherwise pre-fill the signed-in admin's own
                  saved login into a new staff member's email and password. */}
              <IconInput
                icon={<Mail />}
                id="staff-email"
                name="email"
                type="email"
                defaultValue={user?.email}
                placeholder="name@yourclinic.com"
                autoComplete="off"
                required
                aria-invalid={Boolean(err("email")) || undefined}
              />
              <FieldError>{err("email")}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="staff-phone">Phone</FieldLabel>
              <IconInput
                icon={<Phone />}
                id="staff-phone"
                name="phone"
                type="tel"
                defaultValue={user?.phone ?? undefined}
                placeholder="Enter phone number"
                autoComplete="off"
              />
            </Field>
            <Field data-invalid={Boolean(roleError)}>
              <FieldLabel htmlFor="staff-role">
                Role <RequiredMark />
              </FieldLabel>
              <input type="hidden" name="role" value={role} />
              <div className="relative">
                <UserCog
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2"
                  aria-hidden
                />
                <Select
                  value={role}
                  onValueChange={(v) => {
                    setRole(v);
                    setRoleMissing(false);
                  }}
                >
                  <SelectTrigger
                    ref={roleTriggerRef}
                    id="staff-role"
                    className="h-11! w-full pl-10"
                    aria-invalid={Boolean(roleError) || undefined}
                  >
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.name}>
                        {ROLE_LABEL[r.name] ?? r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FieldError>{roleError}</FieldError>
            </Field>
          </div>
        </FormSection>

        <FormSection icon={CalendarDays} title="Employment Details">
          <div>
            <Field>
              <FieldLabel htmlFor="staff-joining">Joining Date</FieldLabel>
              <IconInput
                ref={joiningRef}
                icon={<CalendarDays />}
                id="staff-joining"
                name="joiningDate"
                type="date"
                defaultValue={user ? user.joiningDate.toISOString().slice(0, 10) : undefined}
              />
              <FieldDescription className="text-xs">
                {isEdit ? "The date they started at the clinic." : "Defaults to today."}
              </FieldDescription>
            </Field>
          </div>
        </FormSection>

        {requirePassword && (
          <FormSection icon={LockKeyhole} title="Account Security">
            <div>
              <Field data-invalid={Boolean(err("password"))}>
                <FieldLabel htmlFor="staff-password">
                  Initial Password <RequiredMark />
                </FieldLabel>
                <PasswordInput
                  id="staff-password"
                  name="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  aria-invalid={Boolean(err("password")) || undefined}
                />
                <FieldDescription className="flex items-start gap-1.5 text-xs">
                  <ShieldCheck className="text-brand mt-px size-3.5 shrink-0" aria-hidden />
                  At least 8 characters. Share it securely; they can change it after signing in.
                </FieldDescription>
                <FieldError>{err("password")}</FieldError>
              </Field>
            </div>
          </FormSection>
        )}

        <div className="border-border/70 bg-muted/30 flex gap-3 border-t px-5 py-4 sm:justify-end sm:px-7">
          <Button asChild variant="outline" size="lg" className="flex-1 sm:flex-none">
            <Link href="/staff">Cancel</Link>
          </Button>
          <SubmitButton label={submitLabel} icon={isEdit ? <Check /> : <UserPlus />} />
        </div>
      </div>
    </form>
  );
}
