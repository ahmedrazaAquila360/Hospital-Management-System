import "server-only";
import { prisma } from "@/lib/prisma";
import { BUILT_IN_ROLES } from "@/lib/permissions";

/** Roles with their user counts and permission keys, for the Role Permissions tab. */
export async function getRolesWithPermissions() {
  const roles = await prisma.role.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      label: true,
      description: true,
      _count: { select: { users: true } },
      permissions: { select: { permission: { select: { key: true } } } },
    },
  });
  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    label: r.label,
    // Built-in roles were seeded with a placeholder ("… — 13 clinic modules"); show the real summary.
    description: BUILT_IN_ROLES.find((b) => b.name === r.name && (!r.description || r.description.includes("clinic modules")))?.description ?? r.description,
    userCount: r._count.users,
    keys: r.permissions.map((p) => p.permission.key),
  }));
}

/** Staff with their role's permissions and personal overrides, for the User Permissions tab. */
export async function getUsersWithPermissions() {
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      status: true,
      role: { select: { name: true, label: true, permissions: { select: { permission: { select: { key: true } } } } } },
      permissionOverrides: { select: { granted: true, permission: { select: { key: true } } } },
    },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
    active: u.status === "ACTIVE",
    roleName: u.role.name,
    roleLabel: u.role.label,
    roleKeys: u.role.permissions.map((p) => p.permission.key),
    overrides: u.permissionOverrides.map((o) => ({ key: o.permission.key, granted: o.granted })),
  }));
}

export type RoleWithPermissions = Awaited<ReturnType<typeof getRolesWithPermissions>>[number];
export type UserWithPermissions = Awaited<ReturnType<typeof getUsersWithPermissions>>[number];
