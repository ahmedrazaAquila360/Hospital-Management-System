"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guard";
import {
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
  SUPER_ADMIN,
  can,
  isBuiltInRole,
  type SessionUser,
} from "@/lib/permissions";

export type PermissionActionResult = { ok?: true; error?: string; id?: string };

const NO_PERMISSION = "You don't have permission to change permissions.";
const VALID = new Set<string>(ALL_PERMISSION_KEYS);

async function requireEditor(): Promise<SessionUser | null> {
  const user = await requireUser();
  return can(user, "permissions.edit") ? user : null;
}

/** Keeps only known keys and adds `<module>.view` whenever another action of that module is on. */
function normalise(keys: string[]) {
  const set = new Set(keys.filter((k) => VALID.has(k)));
  for (const k of [...set]) {
    const [module, action] = k.split(".");
    if (action !== "view" && VALID.has(`${module}.view`)) set.add(`${module}.view`);
  }
  return [...set];
}

async function permissionIds(keys: string[]) {
  const rows = await prisma.permission.findMany({ where: { key: { in: keys } }, select: { id: true, key: true } });
  return new Map(rows.map((r) => [r.key, r.id]));
}

function refresh() {
  revalidatePath("/permissions");
  // Sidebar and every page read permissions per request; refresh cached layouts too.
  revalidatePath("/", "layout");
}

async function log(actor: SessionUser, description: string, entityId?: string) {
  await prisma.activityLog.create({ data: { userId: actor.id, action: "PERMISSIONS", entityType: "Permission", entityId, description } });
}

/** Replaces a role's permission set. The Super Admin role always has everything and can't be changed. */
export async function saveRolePermissionsAction(roleId: string, keys: string[]): Promise<PermissionActionResult> {
  const actor = await requireEditor();
  if (!actor) return { error: NO_PERMISSION };
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return { error: "This role no longer exists." };
  if (role.name === SUPER_ADMIN) return { error: "Super Admin always has full access and can't be changed." };

  const next = normalise(keys);
  if (role.name === actor.role.name && actor.role.name !== SUPER_ADMIN && !next.includes("permissions.edit")) {
    return { error: "You can't remove Permissions access from your own role — you'd be locked out." };
  }
  const ids = await permissionIds(next);
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({ data: next.map((k) => ({ roleId, permissionId: ids.get(k)! })), skipDuplicates: true }),
  ]);
  await log(actor, `${actor.name} updated permissions for the ${role.label} role (${next.length} enabled).`, roleId);
  refresh();
  return { ok: true };
}

/** Built-in roles go back to their default matrix; custom roles are cleared. */
export async function resetRolePermissionsAction(roleId: string): Promise<PermissionActionResult> {
  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { name: true } });
  if (!role) return { error: "This role no longer exists." };
  return saveRolePermissionsAction(roleId, isBuiltInRole(role.name) ? DEFAULT_ROLE_PERMISSIONS[role.name] : []);
}

/** Adds a custom role, optionally copying another role's permissions. */
export async function createRoleAction(input: { label: string; description: string; copyFromRoleId?: string }): Promise<PermissionActionResult> {
  const actor = await requireEditor();
  if (!actor) return { error: NO_PERMISSION };
  const label = input.label.trim();
  if (label.length < 2) return { error: "Enter a role name (at least 2 characters)." };
  if (label.length > 40) return { error: "Keep the role name under 40 characters." };
  const name = label.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (!name) return { error: "Use letters or numbers in the role name." };
  if (await prisma.role.findFirst({ where: { OR: [{ name }, { label: { equals: label, mode: "insensitive" } }] } })) {
    return { error: "A role with this name already exists." };
  }

  let keys: string[] = [];
  if (input.copyFromRoleId) {
    const source = await prisma.role.findUnique({ where: { id: input.copyFromRoleId }, select: { name: true, permissions: { select: { permission: { select: { key: true } } } } } });
    // Copying Super Admin copies everything except the Permissions page itself.
    keys = source?.name === SUPER_ADMIN ? ALL_PERMISSION_KEYS.filter((k) => !k.startsWith("permissions.")) : (source?.permissions.map((p) => p.permission.key) ?? []);
  }
  const ids = await permissionIds(keys);
  const role = await prisma.role.create({
    data: {
      name,
      label,
      description: input.description.trim() || null,
      permissions: { create: keys.map((k) => ({ permissionId: ids.get(k)! })) },
    },
  });
  await log(actor, `${actor.name} added the ${label} role.`, role.id);
  refresh();
  return { ok: true, id: role.id };
}

/** Deletes a custom role that no one is assigned to. */
export async function deleteRoleAction(roleId: string): Promise<PermissionActionResult> {
  const actor = await requireEditor();
  if (!actor) return { error: NO_PERMISSION };
  const role = await prisma.role.findUnique({ where: { id: roleId }, include: { _count: { select: { users: true } } } });
  if (!role) return { error: "This role no longer exists." };
  if (isBuiltInRole(role.name)) return { error: "Built-in roles can't be deleted." };
  if (role._count.users > 0) return { error: `Move the ${role._count.users} user(s) on this role to another role first.` };
  await prisma.role.delete({ where: { id: roleId } });
  await log(actor, `${actor.name} deleted the ${role.label} role.`, roleId);
  refresh();
  return { ok: true };
}

/**
 * Saves one user's effective permissions as overrides on top of their role: anything the
 * role lacks is granted, anything the role has but the user shouldn't is revoked.
 */
export async function saveUserPermissionsAction(userId: string, keys: string[]): Promise<PermissionActionResult> {
  const actor = await requireEditor();
  if (!actor) return { error: NO_PERMISSION };
  if (userId === actor.id) return { error: "You can't change your own permissions." };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, role: { select: { name: true, permissions: { select: { permission: { select: { key: true } } } } } } },
  });
  if (!user) return { error: "This user no longer exists." };
  if (user.role.name === SUPER_ADMIN) return { error: "Super Admins always have full access." };

  const wanted = new Set(normalise(keys));
  const roleKeys = new Set(user.role.permissions.map((p) => p.permission.key));
  const overrides = [
    ...[...wanted].filter((k) => !roleKeys.has(k)).map((key) => ({ key, granted: true })),
    ...[...roleKeys].filter((k) => VALID.has(k) && !wanted.has(k)).map((key) => ({ key, granted: false })),
  ];
  const ids = await permissionIds(overrides.map((o) => o.key));
  await prisma.$transaction([
    prisma.userPermission.deleteMany({ where: { userId } }),
    prisma.userPermission.createMany({ data: overrides.map((o) => ({ userId, permissionId: ids.get(o.key)!, granted: o.granted })) }),
  ]);
  await log(actor, `${actor.name} set custom permissions for ${user.name} (${overrides.length} difference${overrides.length === 1 ? "" : "s"} from role).`, userId);
  refresh();
  return { ok: true };
}

/** Removes a user's overrides so they follow their role again. */
export async function resetUserPermissionsAction(userId: string): Promise<PermissionActionResult> {
  const actor = await requireEditor();
  if (!actor) return { error: NO_PERMISSION };
  if (userId === actor.id) return { error: "You can't change your own permissions." };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  if (!user) return { error: "This user no longer exists." };
  await prisma.userPermission.deleteMany({ where: { userId } });
  await log(actor, `${actor.name} reset ${user.name}'s permissions to their role.`, userId);
  refresh();
  return { ok: true };
}
