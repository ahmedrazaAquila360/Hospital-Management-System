"use client";

import { Lock, Mail, Phone, UserRound } from "lucide-react";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { updateProfileAction } from "@/server/settings/actions";
import { initialsFromName } from "@/lib/format";
import type { SessionUser } from "@/lib/permissions";
import {
  FieldRow,
  IconInput,
  ImagePicker,
  RequiredMark,
  SettingsFooter,
  SettingsPanel,
  SettingsSection,
  useSettingsForm,
} from "@/components/settings/settings-ui";

export function ProfileTab({ user }: { user: SessionUser }) {
  const { pending, dirty, formProps } = useSettingsForm(updateProfileAction, "Profile updated.");

  return (
    <SettingsPanel title="Profile" description="Update your personal information and how others see you in the system.">
      <form {...formProps}>
        <SettingsSection>
          <ImagePicker
            name="avatar"
            title="Profile photo"
            currentUrl={user.avatarUrl}
            fallback={initialsFromName(user.name)}
            alt={user.name}
            buttonLabel="Change photo"
          />
        </SettingsSection>

        <SettingsSection title="Personal information">
          <FieldGroup className="gap-5">
            <FieldRow>
              <Field>
                <FieldLabel htmlFor="profile-name">
                  Full Name <RequiredMark />
                </FieldLabel>
                <IconInput
                  icon={<UserRound />}
                  id="profile-name"
                  name="name"
                  defaultValue={user.name}
                  autoComplete="name"
                  minLength={2}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-email">Email</FieldLabel>
                <IconInput
                  icon={<Mail />}
                  id="profile-email"
                  defaultValue={user.email}
                  disabled
                  trailing={<Lock className="text-muted-foreground size-3.5" aria-hidden />}
                />
                <FieldDescription className="text-xs">Your sign-in email. Ask an administrator to change it.</FieldDescription>
              </Field>
            </FieldRow>
            <FieldRow>
              <Field>
                <FieldLabel htmlFor="profile-phone">Phone</FieldLabel>
                <IconInput
                  icon={<Phone />}
                  id="profile-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+1 (555) 000-0000"
                  defaultValue={user.phone ?? undefined}
                />
              </Field>
            </FieldRow>
          </FieldGroup>
        </SettingsSection>

        <SettingsFooter pending={pending} dirty={dirty} />
      </form>
    </SettingsPanel>
  );
}
