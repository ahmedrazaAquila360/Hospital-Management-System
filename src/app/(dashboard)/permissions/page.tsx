import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { getRolesWithPermissions, getUsersWithPermissions } from "@/server/permissions/queries";
import { PermissionsManager } from "@/components/permissions/permissions-manager";
import { PageHeader } from "@/components/shared/page-header";
import { ToothOutline } from "@/components/brand/brand-logo";

export const metadata: Metadata = { title: "Permissions" };

export default async function PermissionsPage() {
  const user = await requirePermission("permissions.view");
  const [roles, users] = await Promise.all([getRolesWithPermissions(), getUsersWithPermissions()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <PageHeader icon={<ShieldCheck />} title="Permissions Management" description="Configure role-based and user-specific access permissions for the system." />
        <ToothOutline className="absolute -top-3 right-4 hidden md:block" />
      </div>
      <PermissionsManager roles={roles} users={users} canEdit={can(user, "permissions.edit")} currentUserId={user.id} currentRoleName={user.role.name} />
    </div>
  );
}
