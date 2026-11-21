import type { Metadata } from "next";
import { Users } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { SUPER_ADMIN } from "@/lib/permissions";
import { getRoles } from "@/server/staff/queries";
import { StaffForm } from "@/components/staff/staff-form";
import { createStaffAction } from "@/server/staff/actions";
import { PageHeader } from "@/components/shared/page-header";
import { ToothOutline } from "@/components/brand/brand-logo";

export const metadata: Metadata = { title: "Add Staff Member" };

export default async function NewStaffPage() {
  const actor = await requirePermission("staff.create");
  const actorIsSuperAdmin = actor.role.name === SUPER_ADMIN;
  const roles = await getRoles();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="relative">
        <PageHeader
          back={{ href: "/staff", label: "Back to Staff" }} icon={<Users />} title="Add Staff Member" description="Create a new account for your clinic team." />
        <ToothOutline className="absolute -top-3 right-4 hidden md:block" />
      </div>
      <StaffForm action={createStaffAction} roles={actorIsSuperAdmin ? roles : roles.filter((role) => role.name !== SUPER_ADMIN)} requirePassword submitLabel="Add Staff Member" />
    </div>
  );
}
