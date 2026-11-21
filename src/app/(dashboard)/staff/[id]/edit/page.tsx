import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserCog } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { SUPER_ADMIN } from "@/lib/permissions";
import { getStaffById, getRoles } from "@/server/staff/queries";
import { StaffForm } from "@/components/staff/staff-form";
import { updateStaffAction } from "@/server/staff/actions";
import { PageHeader } from "@/components/shared/page-header";
import { ToothOutline } from "@/components/brand/brand-logo";

export const metadata: Metadata = { title: "Edit Staff Member" };

export default async function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission("staff.edit");
  const actorIsSuperAdmin = actor.role.name === SUPER_ADMIN;
  const { id } = await params;
  const [user, roles] = await Promise.all([getStaffById(id), getRoles()]);
  if (!user) notFound();
  // Only a Super Admin can edit a Super Admin account.
  if (user.role.name === SUPER_ADMIN && !actorIsSuperAdmin) notFound();

  const boundAction = updateStaffAction.bind(null, id);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="relative">
        <PageHeader
          back={{ href: "/staff", label: "Back to Staff" }}
          icon={<UserCog />}
          title="Edit Staff Member"
          description={<>Update {user.name}&apos;s account details.</>}
        />
        <ToothOutline className="absolute -top-3 right-4 hidden md:block" />
      </div>
      <StaffForm action={boundAction} roles={actorIsSuperAdmin ? roles : roles.filter((role) => role.name !== SUPER_ADMIN)} user={user} submitLabel="Save Changes" />
    </div>
  );
}
