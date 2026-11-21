import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { requireUser } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { getClinicSettings } from "@/server/settings/queries";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { ProfileTab } from "@/components/settings/profile-tab";
import { PasswordTab } from "@/components/settings/password-tab";
import { ClinicTab } from "@/components/settings/clinic-tab";
import { SystemTab } from "@/components/settings/system-tab";
import { WorkingHoursTab } from "@/components/settings/working-hours-tab";
import { parseWorkingHours } from "@/lib/working-hours";
import { PageHeader } from "@/components/shared/page-header";
import { ToothOutline } from "@/components/brand/brand-logo";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [user, { tab }] = await Promise.all([requireUser(), searchParams]);
  const canManageClinic = can(user, "settings.edit");
  const clinic = canManageClinic ? await getClinicSettings() : null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="relative">
        <PageHeader
          icon={<Settings />}
          title="Settings"
          description="Manage your account and clinic preferences."
        />
        <ToothOutline className="absolute -top-3 right-4 hidden md:block" />
      </div>
      <SettingsTabs
        defaultTab={tab}
        profile={<ProfileTab user={user} />}
        password={<PasswordTab />}
        clinic={clinic ? <ClinicTab clinic={clinic} /> : undefined}
        hours={clinic ? <WorkingHoursTab initial={parseWorkingHours(clinic.workingHours)} /> : undefined}
        system={clinic ? <SystemTab clinic={clinic} /> : undefined}
      />
    </div>
  );
}
