"use client";

import { useState } from "react";
import { Check, Circle, KeyRound, ShieldCheck } from "lucide-react";
import { PasswordInput } from "@/components/shared/icon-input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { changePasswordAction } from "@/server/settings/actions";
import { cn } from "@/lib/utils";
import {
  FieldRow,
  RequiredMark,
  SettingsFooter,
  SettingsPanel,
  SettingsSection,
  useSettingsForm,
} from "@/components/settings/settings-ui";

function Requirement({ met, children }: { met: boolean; children: string }) {
  return (
    <li className={cn("flex items-center gap-2 text-xs transition-colors", met ? "text-success" : "text-muted-foreground")}>
      {met ? <Check className="size-3.5" aria-hidden /> : <Circle className="size-3.5" aria-hidden />}
      {children}
      <span className="sr-only">{met ? "(met)" : "(not met)"}</span>
    </li>
  );
}

export function PasswordTab() {
  const { pending, dirty, formProps } = useSettingsForm(changePasswordAction, "Password updated.");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  return (
    <SettingsPanel title="Password" description="Change the password you use to sign in to DentalHub.">
      <form
        {...formProps}
        onReset={() => {
          formProps.onReset();
          setNext("");
          setConfirm("");
        }}
      >
        <SettingsSection title="Current password" description="Confirm it's you before choosing a new password.">
          <FieldRow>
            <Field>
              <FieldLabel htmlFor="currentPassword">
                Current Password <RequiredMark />
              </FieldLabel>
              <PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password" required />
            </Field>
          </FieldRow>
        </SettingsSection>

        <SettingsSection title="New password">
          <FieldGroup className="gap-5">
            <FieldRow>
              <Field>
                <FieldLabel htmlFor="newPassword">
                  New Password <RequiredMark />
                </FieldLabel>
                <PasswordInput
                  id="newPassword"
                  name="newPassword"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  onChange={(e) => setNext(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirmPassword">
                  Confirm New Password <RequiredMark />
                </FieldLabel>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  aria-invalid={confirm.length > 0 && confirm !== next ? true : undefined}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </Field>
            </FieldRow>
            <div className="bg-pale/60 border-brand/10 flex items-start gap-3 rounded-xl border p-4">
              <ShieldCheck className="text-brand mt-0.5 size-4 shrink-0" aria-hidden />
              <div>
                <p className="text-navy text-xs font-semibold">Password requirements</p>
                <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  <Requirement met={next.length >= 8}>At least 8 characters</Requirement>
                  <Requirement met={confirm.length > 0 && confirm === next}>Both new passwords match</Requirement>
                </ul>
              </div>
            </div>
          </FieldGroup>
        </SettingsSection>

        <SettingsFooter pending={pending} dirty={dirty} submitLabel="Update Password" submitIcon={<KeyRound />} />
      </form>
    </SettingsPanel>
  );
}
