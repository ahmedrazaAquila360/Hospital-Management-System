"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Crown,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserCog,
  UserRound,
  Users,
  Headset,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldLabel } from "@/components/ui/field";
import { PermissionMatrix } from "@/components/permissions/permission-matrix";
import { useConfirm } from "@/components/shared/confirm-dialog";
import {
  createRoleAction,
  deleteRoleAction,
  resetRolePermissionsAction,
  resetUserPermissionsAction,
  saveRolePermissionsAction,
  saveUserPermissionsAction,
} from "@/server/permissions/actions";
import { ALL_PERMISSION_KEYS, SUPER_ADMIN, effectivePermissions, isBuiltInRole } from "@/lib/permissions";
import { initialsFromName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RoleWithPermissions, UserWithPermissions } from "@/server/permissions/queries";

const ROLE_ICON: Record<string, LucideIcon> = { SUPER_ADMIN: Crown, ADMIN: Users, DENTIST: Stethoscope, RECEPTIONIST: Headset, STAFF: UserRound };
const TOTAL = ALL_PERMISSION_KEYS.length;
const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((k) => b.has(k));

/**
 * Permissions Management. Role tab: pick a role, edit its matrix, save or reset. User tab:
 * pick a staff member; their checkboxes start from their role and any change is stored as a
 * personal override. Selection lives in the URL (?tab, ?role, ?user).
 */
export function PermissionsManager({
  roles,
  users,
  canEdit,
  currentUserId,
  currentRoleName,
}: {
  roles: RoleWithPermissions[];
  users: UserWithPermissions[];
  canEdit: boolean;
  currentUserId: string;
  currentRoleName: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = params.get("tab") === "users" ? "users" : "roles";
  const { confirm, dialog } = useConfirm();

  async function go(next: Record<string, string>, dirty: boolean) {
    if (
      dirty &&
      !(await confirm({
        title: "Discard unsaved changes?",
        description: "You've changed permissions without saving. If you leave now, those changes will be lost.",
        confirmLabel: "Discard Changes",
        cancelLabel: "Keep Editing",
        tone: "destructive",
      }))
    )
      return;
    const sp = new URLSearchParams(next);
    router.push(`${pathname}?${sp}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-5">
      {dialog}
      <nav className="border-border/70 flex gap-6 border-b" aria-label="Permission type">
        {[
          ["roles", "Role Permissions"],
          ["users", "User Permissions"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => go({ tab: value }, false)}
            aria-current={tab === value ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-1 pb-3 text-[0.95rem] font-semibold transition-colors",
              tab === value ? "border-brand text-brand" : "text-muted-foreground hover:text-foreground border-transparent"
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "roles" ? (
        <RolesTab roles={roles} canEdit={canEdit} currentRoleName={currentRoleName} selectedId={params.get("role")} onSelect={(id, dirty) => go({ tab: "roles", role: id }, dirty)} />
      ) : (
        <UsersTab users={users} canEdit={canEdit} currentUserId={currentUserId} selectedId={params.get("user")} onSelect={(id, dirty) => go({ tab: "users", user: id }, dirty)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Roles */

function RolesTab({
  roles,
  canEdit,
  currentRoleName,
  selectedId,
  onSelect,
}: {
  roles: RoleWithPermissions[];
  canEdit: boolean;
  currentRoleName: string;
  selectedId: string | null;
  onSelect: (id: string, dirty: boolean) => void;
}) {
  const role = roles.find((r) => r.id === selectedId) ?? roles.find((r) => r.name !== SUPER_ADMIN) ?? roles[0];
  const [dirty, setDirty] = useState(false);

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[19rem_minmax(0,1fr)]">
      <aside className="surface-card flex flex-col gap-3 p-4 xl:sticky xl:top-24">
        <div className="flex items-center justify-between gap-2 px-1">
          <h3 className="text-navy text-lg font-semibold">Roles</h3>
          {canEdit && <AddRoleDialog roles={roles} onCreated={(id) => onSelect(id, false)} />}
        </div>
        <ul className="flex flex-col gap-2">
          {roles.map((r) => {
            const Icon = ROLE_ICON[r.name] ?? ShieldCheck;
            const active = r.id === role?.id;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => r.id !== role?.id && onSelect(r.id, dirty)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                    active ? "border-brand/40 bg-pale ring-brand/20 ring-2" : "border-border/70 hover:bg-pale/40"
                  )}
                  aria-current={active ? "true" : undefined}
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl",
                      r.name === SUPER_ADMIN ? "bg-amber-50 text-amber-500" : "text-brand bg-white shadow-xs"
                    )}
                    aria-hidden
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-navy block truncate font-semibold">{r.label}</span>
                    <span className="text-muted-foreground block truncate text-xs">{r.description ?? `${r.keys.length} permissions`}</span>
                  </span>
                  <span className="text-muted-foreground bg-muted rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums" title="Users with this role">
                    {r.userCount}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {role && (
        <RoleEditor
          key={`${role.id}:${role.keys.slice().sort().join(",")}`}
          role={role}
          canEdit={canEdit}
          isOwnRole={role.name === currentRoleName}
          onDirtyChange={setDirty}
          onDeleted={() => onSelect(roles.find((r) => r.name !== SUPER_ADMIN && r.id !== role.id)?.id ?? "", false)}
        />
      )}
    </div>
  );
}

function RoleEditor({
  role,
  canEdit,
  isOwnRole,
  onDirtyChange,
  onDeleted,
}: {
  role: RoleWithPermissions;
  canEdit: boolean;
  isOwnRole: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const isSuper = role.name === SUPER_ADMIN;
  const saved = useMemo(() => new Set(isSuper ? ALL_PERMISSION_KEYS : role.keys), [isSuper, role.keys]);
  const [value, setValue] = useState<Set<string>>(saved);
  const [isPending, startTransition] = useTransition();
  const dirty = !sameSet(value, saved);
  const locked = !canEdit || isSuper;
  const Icon = ROLE_ICON[role.name] ?? ShieldCheck;
  const { confirm, dialog } = useConfirm();

  function update(next: Set<string>) {
    setValue(next);
    onDirtyChange(!sameSet(next, saved));
  }

  function run(fn: () => Promise<{ ok?: true; error?: string }>, success: string) {
    startTransition(async () => {
      try {
        const result = await fn();
        if (result.error) return void toast.error(result.error);
        toast.success(success);
        onDirtyChange(false);
        router.refresh();
      } catch {
        toast.error("Couldn't save the permissions. Please try again.");
      }
    });
  }

  return (
    <section className="surface-card flex min-w-0 flex-col gap-5 p-5 sm:p-6">
      {dialog}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", isSuper ? "bg-amber-50 text-amber-500" : "bg-pale text-brand")} aria-hidden>
            <Icon className="size-6" />
          </span>
          <div>
            <h3 className="font-heading text-navy text-xl font-semibold">{role.label}</h3>
            <p className="text-muted-foreground text-sm">
              {isSuper ? "Super Admin always has full access to every module and action." : "Configure what this role can access and do in the system."}
            </p>
          </div>
        </div>
        {!locked && (
          <div className="flex flex-wrap gap-2">
            {!isBuiltInRole(role.name) && role.userCount === 0 && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive rounded-xl"
                disabled={isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: `Delete the ${role.label} role?`,
                    description: "This role and its permission settings will be removed permanently. No staff members are assigned to it.",
                    confirmLabel: "Delete Role",
                    tone: "destructive",
                  });
                  if (!ok) return;
                  startTransition(async () => {
                    const result = await deleteRoleAction(role.id);
                    if (result.error) return void toast.error(result.error);
                    toast.success(`Deleted the ${role.label} role.`);
                    onDeleted();
                    router.refresh();
                  });
                }}
              >
                <Trash2 /> Delete Role
              </Button>
            )}
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={isPending}
              onClick={async () => {
                const builtIn = isBuiltInRole(role.name);
                const ok = await confirm({
                  title: `Reset ${role.label} to default?`,
                  description: builtIn
                    ? `${role.label} goes back to its standard DentalHub permissions. This is saved immediately and applies to everyone with this role (${role.userCount} user${role.userCount === 1 ? "" : "s"}).`
                    : `Custom roles have no defaults, so every permission will be removed from ${role.label}. This is saved immediately.`,
                  confirmLabel: "Reset to Default",
                  tone: "warning",
                });
                if (ok) run(() => resetRolePermissionsAction(role.id), `${role.label} reset to default.`);
              }}
            >
              <RotateCcw /> Reset to Default
            </Button>
            <Button className="rounded-xl" disabled={!dirty || isPending} onClick={() => run(() => saveRolePermissionsAction(role.id, [...value]), `Permissions saved for ${role.label}.`)}>
              {isPending ? <Loader2 className="animate-spin" /> : <Check />} Save Changes
            </Button>
          </div>
        )}
      </div>

      <Stats users={role.userCount} enabled={value.size} />

      {isSuper && <Notice icon={Lock}>Super Admin permissions are locked so the system can never be left without a full administrator.</Notice>}
      {!isSuper && !canEdit && <Notice icon={Lock}>You can view permissions but not change them.</Notice>}
      {isOwnRole && !isSuper && canEdit && <Notice icon={KeyRound}>This is your own role. Changes apply to you on your next page load.</Notice>}
      {dirty && <p className="text-xs font-medium text-amber-700">You have unsaved changes.</p>}

      <PermissionMatrix value={value} onChange={update} disabled={locked || isPending} />
    </section>
  );
}

function AddRoleDialog({ roles, onCreated }: { roles: RoleWithPermissions[]; onCreated: (id: string) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [copyFrom, setCopyFrom] = useState("none");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createRoleAction({ label, description, copyFromRoleId: copyFrom === "none" ? undefined : copyFrom });
      if (result.error) return setError(result.error);
      toast.success(`Added the ${label.trim()} role.`);
      setOpen(false);
      setLabel("");
      setDescription("");
      setCopyFrom("none");
      router.refresh();
      if (result.id) onCreated(result.id);
    });
  }

  return (
    <>
      <Button size="sm" className="rounded-xl" onClick={() => setOpen(true)}>
        <Plus /> Add Role
      </Button>
      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-navy">Add Role</DialogTitle>
            <DialogDescription>Create a role, then choose its permissions. Assign it to staff from the Staff page.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {error && <p className="bg-destructive/5 text-destructive rounded-lg px-3 py-2 text-sm" role="alert">{error}</p>}
            <Field>
              <FieldLabel htmlFor="role-label">Role name</FieldLabel>
              <Input id="role-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Assistant" maxLength={40} autoFocus />
            </Field>
            <Field>
              <FieldLabel htmlFor="role-desc">Description</FieldLabel>
              <Textarea id="role-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="e.g. Clinical support and basic access" maxLength={120} />
            </Field>
            <Field>
              <FieldLabel htmlFor="role-copy">Start from</FieldLabel>
              <Select value={copyFrom} onValueChange={setCopyFrom}>
                <SelectTrigger id="role-copy" className="h-10! w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No permissions</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      Copy {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={submit} disabled={isPending || label.trim().length < 2}>
              {isPending ? <Loader2 className="animate-spin" /> : <Plus />} Add Role
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------------ Users */

function UsersTab({
  users,
  canEdit,
  currentUserId,
  selectedId,
  onSelect,
}: {
  users: UserWithPermissions[];
  canEdit: boolean;
  currentUserId: string;
  selectedId: string | null;
  onSelect: (id: string, dirty: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [dirty, setDirty] = useState(false);
  const user = users.find((u) => u.id === selectedId) ?? users.find((u) => u.roleName !== SUPER_ADMIN) ?? users[0];
  const shown = users.filter((u) => !query.trim() || `${u.name} ${u.email} ${u.roleLabel}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[19rem_minmax(0,1fr)]">
      <aside className="surface-card flex flex-col gap-3 p-4 xl:sticky xl:top-24">
        <h3 className="text-navy px-1 text-lg font-semibold">Staff Members</h3>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search staff…" className="h-10 rounded-xl pl-9" aria-label="Search staff" />
        </div>
        <ul className="flex max-h-[34rem] flex-col gap-1.5 overflow-y-auto">
          {shown.map((u) => {
            const active = u.id === user?.id;
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => u.id !== user?.id && onSelect(u.id, dirty)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                    active ? "border-brand/40 bg-pale ring-brand/20 ring-2" : "hover:bg-pale/40 border-transparent"
                  )}
                >
                  <Avatar className="size-9 shrink-0">
                    {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt="" className="object-cover" />}
                    <AvatarFallback className="text-navy bg-linear-to-br from-[#e3f4fd] to-[#cbe8fa] text-xs font-semibold">{initialsFromName(u.name)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className={cn("text-navy block truncate text-sm font-semibold", !u.active && "opacity-60")}>{u.name}</span>
                    <span className="text-muted-foreground block truncate text-xs">{u.roleLabel}</span>
                  </span>
                  {u.overrides.length > 0 && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700" title="Has custom permissions">
                      Custom
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {shown.length === 0 && <li className="text-muted-foreground px-2 py-6 text-center text-sm">No staff match.</li>}
        </ul>
      </aside>

      {user && (
        <UserEditor
          key={`${user.id}:${user.overrides.map((o) => `${o.key}${o.granted}`).sort().join(",")}:${user.roleKeys.length}`}
          user={user}
          canEdit={canEdit}
          isSelf={user.id === currentUserId}
          onDirtyChange={setDirty}
        />
      )}
    </div>
  );
}

function UserEditor({ user, canEdit, isSelf, onDirtyChange }: { user: UserWithPermissions; canEdit: boolean; isSelf: boolean; onDirtyChange: (dirty: boolean) => void }) {
  const router = useRouter();
  const isSuper = user.roleName === SUPER_ADMIN;
  const roleSet = useMemo(() => new Set(isSuper ? ALL_PERMISSION_KEYS : user.roleKeys), [isSuper, user.roleKeys]);
  const saved = useMemo(() => new Set(effectivePermissions(user.roleName, user.roleKeys, user.overrides)), [user]);
  const [value, setValue] = useState<Set<string>>(saved);
  const [isPending, startTransition] = useTransition();
  const dirty = !sameSet(value, saved);
  const locked = !canEdit || isSuper || isSelf;
  const { confirm, dialog } = useConfirm();
  const customCount = [...new Set([...value, ...roleSet])].filter((k) => value.has(k) !== roleSet.has(k)).length;

  function update(next: Set<string>) {
    setValue(next);
    onDirtyChange(!sameSet(next, saved));
  }

  function run(fn: () => Promise<{ ok?: true; error?: string }>, success: string) {
    startTransition(async () => {
      try {
        const result = await fn();
        if (result.error) return void toast.error(result.error);
        toast.success(success);
        onDirtyChange(false);
        router.refresh();
      } catch {
        toast.error("Couldn't save the permissions. Please try again.");
      }
    });
  }

  return (
    <section className="surface-card flex min-w-0 flex-col gap-5 p-5 sm:p-6">
      {dialog}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-12 shrink-0">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" className="object-cover" />}
            <AvatarFallback className="text-navy bg-linear-to-br from-[#e3f4fd] to-[#cbe8fa] font-semibold">{initialsFromName(user.name)}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-heading text-navy text-xl font-semibold">{user.name}</h3>
            <p className="text-muted-foreground text-sm">
              {user.email} · Role: <span className="text-foreground/80 font-medium">{user.roleLabel}</span>
            </p>
          </div>
        </div>
        {!locked && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={isPending || user.overrides.length === 0}
              onClick={async () => {
                const ok = await confirm({
                  title: "Reset to role permissions?",
                  description: `${user.name}'s custom permissions will be removed and they'll follow the ${user.roleLabel} role again. This is saved immediately.`,
                  confirmLabel: "Reset to Role",
                  tone: "warning",
                });
                if (ok) run(() => resetUserPermissionsAction(user.id), `${user.name} now follows the ${user.roleLabel} role.`);
              }}
            >
              <RotateCcw /> Reset to Role
            </Button>
            <Button className="rounded-xl" disabled={!dirty || isPending} onClick={() => run(() => saveUserPermissionsAction(user.id, [...value]), `Permissions saved for ${user.name}.`)}>
              {isPending ? <Loader2 className="animate-spin" /> : <Check />} Save Changes
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MiniStat icon={UserCog} value={user.roleLabel} label="Role" />
        <MiniStat icon={KeyRound} value={value.size} label="Permissions Enabled" />
        <MiniStat icon={ShieldCheck} value={customCount} label="Custom for this user" tone={customCount ? "warning" : undefined} />
      </div>

      {isSuper && <Notice icon={Lock}>Super Admins always have full access; their permissions can&apos;t be changed.</Notice>}
      {isSelf && !isSuper && <Notice icon={Lock}>You can&apos;t change your own permissions. Ask another administrator.</Notice>}
      {!canEdit && !isSuper && !isSelf && <Notice icon={Lock}>You can view permissions but not change them.</Notice>}
      {!locked && <Notice icon={Users}>Ticks start from the {user.roleLabel} role. Anything you change here applies only to {user.name}.</Notice>}
      {dirty && <p className="text-xs font-medium text-amber-700">You have unsaved changes.</p>}

      <PermissionMatrix value={value} onChange={update} disabled={locked || isPending} baseline={roleSet} />
    </section>
  );
}

/* ------------------------------------------------------------------ Bits */

function Stats({ users, enabled }: { users: number; enabled: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <MiniStat icon={UserRound} value={users} label="Users with this role" />
      <MiniStat icon={KeyRound} value={enabled} label="Permissions Enabled" tone="success" />
      <MiniStat icon={Lock} value={`${Math.round((enabled / TOTAL) * 100)}%`} label="Access Coverage" tone="success" />
    </div>
  );
}

function MiniStat({ icon: Icon, value, label, tone }: { icon: LucideIcon; value: string | number; label: string; tone?: "success" | "warning" }) {
  return (
    <div className="border-border/70 flex items-center gap-3 rounded-2xl border bg-white p-4">
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          tone === "success" ? "bg-emerald-50 text-emerald-600" : tone === "warning" ? "bg-amber-50 text-amber-600" : "bg-pale text-brand"
        )}
        aria-hidden
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="font-heading text-navy block truncate text-xl leading-tight font-semibold tabular-nums">{value}</span>
        <span className="text-muted-foreground block truncate text-xs">{label}</span>
      </span>
    </div>
  );
}

function Notice({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <p className="bg-pale/60 text-foreground/80 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm">
      <Icon className="text-brand mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
