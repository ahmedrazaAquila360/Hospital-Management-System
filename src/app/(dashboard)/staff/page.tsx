import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Pencil, Phone, Plus, Stethoscope, UserCheck, UserCog, UserX, Users } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { can, SUPER_ADMIN } from "@/lib/permissions";
import { getStaffStats, listStaff } from "@/server/staff/queries";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StaffStatusToggle } from "@/components/staff/staff-status-toggle";
import { StaffToolbar } from "@/components/staff/staff-toolbar";
import { ListFooter } from "@/components/shared/list-footer";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ToothOutline } from "@/components/brand/brand-logo";
import { formatDate, initialsFromName } from "@/lib/format";
import { parsePage, parsePageSize } from "@/lib/pagination";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Staff" };

const ROLE_STYLE: Record<string, string> = {
  SUPER_ADMIN: "bg-violet-50 text-violet-800",
  ADMIN: "bg-indigo-50 text-indigo-800",
  DENTIST: "bg-blue-50 text-blue-800",
  RECEPTIONIST: "bg-teal-50 text-teal-800",
  STAFF: "bg-slate-100 text-slate-700",
};

type SearchParams = Promise<{ search?: string; role?: string; page?: string; perPage?: string }>;

export default async function StaffPage({ searchParams }: { searchParams: SearchParams }) {
  const currentUser = await requirePermission("staff.view");
  const params = await searchParams;
  const search = params.search?.trim() || undefined;

  const stats = await getStaffStats();
  const roleName = stats.roles.find((r) => r.name === params.role)?.name;
  const list = await listStaff({ search, roleName, page: parsePage(params.page), pageSize: parsePageSize(params.perPage) });
  const dentists = stats.roles.find((r) => r.name === "DENTIST")?.count ?? 0;
  const filtered = Boolean(search || roleName);
  // Super Admin accounts can only be changed by a Super Admin.
  const canEditUser = (role: string) => can(currentUser, "staff.edit") && (role !== SUPER_ADMIN || currentUser.role.name === SUPER_ADMIN);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <PageHeader
          icon={<UserCog />}
          title="Staff"
          description="Manage clinic team members, their roles and account access."
          actions={
            can(currentUser, "staff.create") && (
              <Button asChild size="lg" className="rounded-full px-5">
                <Link href="/staff/new">
                  <Plus /> Add Staff Member
                </Link>
              </Button>
            )
          }
        />
        <ToothOutline className="absolute -top-3 right-64 hidden xl:block" />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={Users} value={stats.total} label="Total Staff" />
        <StatCard icon={UserCheck} value={stats.active} label="Active Accounts" tone="success" />
        <StatCard icon={UserX} value={stats.inactive} label="Inactive Accounts" tone="destructive" />
        <StatCard icon={Stethoscope} value={dentists} label="Dentists" />
      </div>

      <section className="surface-card @container overflow-hidden p-0">
        <StaffToolbar roles={stats.roles.map((r) => ({ name: r.name, label: r.label }))} />

        {list.staff.length === 0 ? (
          <Empty className="w-auto border-border/70 mx-4 mb-5 rounded-2xl border border-dashed py-12 sm:mx-5">
            <EmptyMedia variant="icon">
              <UserCog />
            </EmptyMedia>
            <EmptyTitle>{filtered ? "No matching staff" : "No staff yet"}</EmptyTitle>
            <EmptyDescription>{filtered ? "Try a different name, email or role." : "Add your first team member."}</EmptyDescription>
          </Empty>
        ) : (
          <>
            <div className="hidden @4xl:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground text-left text-xs font-semibold tracking-wide uppercase">
                    <th className="py-3 pr-3 pl-5">Staff Member</th>
                    <th className="px-3 py-3">Role</th>
                    <th className="px-3 py-3">Phone</th>
                    <th className="px-3 py-3">Joined</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="py-3 pr-5 pl-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-border/60 divide-y">
                  {list.staff.map((s) => (
                    <tr key={s.id} className="hover:bg-pale/40 transition-colors">
                      <td className="py-3 pr-3 pl-5">
                        <div className="flex min-w-0 items-center gap-3">
                          <StaffAvatar name={s.name} url={s.avatarUrl} />
                          <span className="min-w-0">
                            <span className="text-navy block truncate font-semibold">
                              {s.name}
                              {s.id === currentUser.id && <span className="text-muted-foreground ml-1.5 text-xs font-normal">(you)</span>}
                            </span>
                            <span className="text-muted-foreground block truncate text-xs">{s.email}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <RoleBadge name={s.role.name} label={s.role.label} />
                      </td>
                      <td className="text-foreground/80 px-3 py-3 whitespace-nowrap tabular-nums">{s.phone ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="text-foreground/80 px-3 py-3 whitespace-nowrap">{formatDate(s.joiningDate)}</td>
                      <td className="px-3 py-3">
                        <StatusCell id={s.id} active={s.status === "ACTIVE"} self={s.id === currentUser.id} locked={!canEditUser(s.role.name)} />
                      </td>
                      <td className="py-3 pr-5 pl-3 text-right">
                        {canEditUser(s.role.name) && <EditButton id={s.id} name={s.name} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-border/60 divide-y @4xl:hidden">
              {list.staff.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <StaffAvatar name={s.name} url={s.avatarUrl} />
                    <div className="min-w-0 space-y-1.5">
                      <p className="text-navy truncate font-semibold">
                        {s.name}
                        {s.id === currentUser.id && <span className="text-muted-foreground ml-1.5 text-xs font-normal">(you)</span>}
                      </p>
                      <RoleBadge name={s.role.name} label={s.role.label} />
                      <p className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
                        <Mail className="size-3.5 shrink-0" aria-hidden /> {s.email}
                      </p>
                      {s.phone && (
                        <p className="text-muted-foreground flex items-center gap-1.5 text-xs tabular-nums">
                          <Phone className="size-3.5 shrink-0" aria-hidden /> {s.phone}
                        </p>
                      )}
                      <p className="text-muted-foreground text-xs">Joined {formatDate(s.joiningDate)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusCell id={s.id} active={s.status === "ACTIVE"} self={s.id === currentUser.id} locked={!canEditUser(s.role.name)} />
                    {canEditUser(s.role.name) && <EditButton id={s.id} name={s.name} />}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <ListFooter page={list.page} pageSize={list.pageSize} total={list.total} shown={list.staff.length} noun="staff member" />
      </section>
    </div>
  );
}

function StaffAvatar({ name, url }: { name: string; url: string | null }) {
  return (
    <Avatar className="size-10 shrink-0 ring-2 ring-white">
      {url && <AvatarImage src={url} alt="" className="object-cover" />}
      <AvatarFallback className="text-navy bg-linear-to-br from-[#e3f4fd] to-[#cbe8fa] text-xs font-semibold">{initialsFromName(name)}</AvatarFallback>
    </Avatar>
  );
}

function RoleBadge({ name, label }: { name: string; label: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap", ROLE_STYLE[name] ?? ROLE_STYLE.STAFF)}>
      {label}
    </span>
  );
}

function StatusCell({ id, active, self, locked }: { id: string; active: boolean; self: boolean; locked: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium" title={self ? "You can't deactivate your own account" : undefined}>
      <StaffStatusToggle id={id} active={active} disabled={self || locked} />
      <span className={active ? "text-success" : "text-muted-foreground"}>{active ? "Active" : "Inactive"}</span>
    </div>
  );
}

function EditButton({ id, name }: { id: string; name: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="ghost" size="icon" className="bg-pale text-brand hover:bg-brand size-9 rounded-xl hover:text-white">
          <Link href={`/staff/${id}/edit`} aria-label={`Edit ${name}`}>
            <Pencil />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Edit staff member</TooltipContent>
    </Tooltip>
  );
}
