import { requirePermission } from "@/lib/auth/guard";
import { basePrisma } from "@/lib/prisma-base";
import { can } from "@/lib/permissions";
import { createBranch, assignBranch, revokeBranch } from "@/server/branches/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export default async function Branches() {
  const actor = await requirePermission("permissions.edit");
  const [branches, users, memberships] = await Promise.all([
    basePrisma.branch.findMany({orderBy: {name: "asc"}}),
    basePrisma.user.findMany({select: {id: true, name: true}, orderBy: {name: "asc"}}),
    basePrisma.branchMembership.findMany(),
  ]);
  return <div className="space-y-6"><h2 className="font-heading text-2xl font-semibold">Hospital branches</h2>
    <p>Staff switch between assigned branches in the header. Patient identity and medical history remain shared; visits, admissions, stock and billing belong to their branch.</p>
    {can(actor,"settings.edit") && <form action={createBranch} className="surface-card flex gap-3 p-5"><Input name="name" placeholder="Branch name" required maxLength={100}/><Button>Create branch</Button></form>}
    {can(actor,"staff.edit") && <form action={assignBranch} className="surface-card flex flex-wrap gap-3 p-5"><select name="userId" aria-label="Staff member" className="rounded-md border p-2">{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select><select name="branchId" aria-label="Branch" className="rounded-md border p-2">{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><Button>Assign branch</Button></form>}
    <div className="surface-card p-5"><table className="w-full text-left text-sm"><thead><tr><th>Branch</th><th>Assigned staff</th></tr></thead><tbody>{branches.map(b=><tr key={b.id} className="border-t"><td className="py-3">{b.name}</td><td>{users.filter(u=>memberships.some(m=>m.active&&m.userId===u.id&&m.branchId===b.id)).map(u=><div key={u.id} className="flex items-center gap-3 py-1">{u.name}{u.id!==actor.id&&can(actor,"staff.edit")&&<form action={revokeBranch}><input type="hidden" name="userId" value={u.id}/><input type="hidden" name="branchId" value={b.id}/><Button variant="outline" size="sm">Remove access</Button></form>}</div>)}</td></tr>)}</tbody></table></div>
  </div>;
}
