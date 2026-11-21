"use client";

import { Building2, Globe, Mail, MapPin, Phone } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { updateClinicSettingsAction } from "@/server/settings/actions";
import type { getClinicSettings } from "@/server/settings/queries";
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

export function ClinicTab({ clinic }: { clinic: Awaited<ReturnType<typeof getClinicSettings>> }) {
  const { pending, dirty, formProps } = useSettingsForm(updateClinicSettingsAction, "Hospital settings updated.");

  return (
    <SettingsPanel title="Hospital" description="Shown on invoices, prescriptions, printed documents and the public site.">
      <form {...formProps}>
        <SettingsSection>
          <ImagePicker
            name="logo"
            title="Hospital logo"
            currentUrl={clinic.logoUrl}
            fallback={<Building2 />}
            alt="Hospital logo"
            shape="square"
            buttonLabel="Upload logo"
          />
        </SettingsSection>

        <SettingsSection title="Hospital details">
          <FieldGroup className="gap-5">
            <FieldRow>
              <Field>
                <FieldLabel htmlFor="clinic-name">
                  Hospital name <RequiredMark />
                </FieldLabel>
                <IconInput
                  icon={<Building2 />}
                  id="clinic-name"
                  name="clinicName"
                  defaultValue={clinic.clinicName}
                  autoComplete="organization"
                  minLength={2}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="registration-number">Hospital registration number</FieldLabel>
                <IconInput icon={<Building2 />} id="registration-number" name="registrationNumber" maxLength={100} defaultValue={clinic.registrationNumber ?? ""} />
              </Field>
            </FieldRow>
            <Field>
              <FieldLabel htmlFor="clinic-address">Address</FieldLabel>
              <div className="relative">
                <MapPin
                  className="text-muted-foreground pointer-events-none absolute top-3 left-3 size-4"
                  aria-hidden
                />
                <Textarea
                  id="clinic-address"
                  name="address"
                  rows={3}
                  autoComplete="street-address"
                  placeholder="Street, city, postcode"
                  defaultValue={clinic.address ?? undefined}
                  className="min-h-24 pl-10"
                />
              </div>
            </Field>
          </FieldGroup>
        </SettingsSection>

        <SettingsSection title="Contact" description="How patients reach the hospital.">
          <FieldGroup className="gap-5">
            <FieldRow>
              <Field>
                <FieldLabel htmlFor="clinic-phone">Phone</FieldLabel>
                <IconInput
                  icon={<Phone />}
                  id="clinic-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+1 (555) 000-0000"
                  defaultValue={clinic.phone ?? undefined}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="clinic-email">Email</FieldLabel>
                <IconInput
                  icon={<Mail />}
                  id="clinic-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="hello@yourclinic.com"
                  defaultValue={clinic.email ?? undefined}
                />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field>
                <FieldLabel htmlFor="clinic-website">Website</FieldLabel>
                <IconInput
                  icon={<Globe />}
                  id="clinic-website"
                  name="website"
                  autoComplete="url"
                  placeholder="www.yourclinic.com"
                  defaultValue={clinic.website ?? undefined}
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
