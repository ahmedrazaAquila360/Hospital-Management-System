import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { assignDepartment, saveDepartment, saveService } from "./actions";

export default async function DepartmentsPage() {
  const actor = await requirePermission("settings.edit");
  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  const services = await prisma.service.findMany({ include: { department: true }, orderBy: { name: "asc" } });
  const staff = can(actor, "staff.edit")
    ? await prisma.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true, branchMemberships: {select: {department: {select: {name: true}}}} },
        orderBy: { name: "asc" },
      })
    : [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        icon={<Building2 />}
        description="Manage hospital departments and staff assignments."
      />
      <Card>
        <CardHeader>
          <CardTitle>Add department</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveDepartment} className="flex flex-wrap items-center gap-3">
            <Input
              className="max-w-sm"
              aria-label="Department name"
              name="name"
              placeholder="Department name"
              maxLength={100}
              required
            />
            <input type="hidden" name="active" value="on" />
            <Button>Add department</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Department directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!departments.length && <p>No departments have been added.</p>}
          {departments.map((d) => (
            <form key={d.id} action={saveDepartment} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="id" value={d.id} />
              <Input
                className="max-w-sm"
                aria-label="Department name"
                name="name"
                defaultValue={d.name}
                maxLength={100}
                required
              />
              <label>
                <input type="checkbox" name="active" defaultChecked={d.active} /> Active
              </label>
              <Button variant="outline">Save</Button>
            </form>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Service pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {services.map((s) => (
            <p key={s.id}>
              {s.name} · {s.category} · {s.department.name} · {s.price.toString()}
            </p>
          ))}
          <form action={saveService} className="grid gap-3 sm:grid-cols-2">
            <label>
              Service name
              <Input name="name" required />
            </label>
            <label>
              Category
              <Input name="category" required placeholder="Radiology, procedure or other service" />
            </label>
            <label>
              Price
              <Input name="price" type="number" min="0" step=".01" required />
            </label>
            <label>
              Department
              <select name="departmentId" required className="block">
                {departments
                  .filter((d) => d.active)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </label>
            <Button>Save price</Button>
          </form>
        </CardContent>
      </Card>
      {staff.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Staff assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={assignDepartment} className="flex flex-wrap items-center gap-3">
              <select
                className="rounded-md border p-2"
                name="staffId"
                aria-label="Staff member"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select staff
                </option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.branchMemberships[0]?.department?.name ?? "Unassigned"}
                  </option>
                ))}
              </select>
              <select className="rounded-md border p-2" name="departmentId" aria-label="Department">
                <option value="">Unassigned</option>
                {departments
                  .filter((d) => d.active)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
              <Button>Save assignment</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
