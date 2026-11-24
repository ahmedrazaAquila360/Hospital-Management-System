import {randomUUID} from "node:crypto";
import {requirePermission} from "@/lib/auth/guard";
import {can} from "@/lib/permissions";
import {prisma} from "@/lib/prisma";
import {Button} from "@/components/ui/button";
import {recordServiceCharge,postConsolidatedCharges,voidPendingServiceCharge} from "@/server/billing/service-charges";

export const metadata={title:"Service charges"};
export default async function ServiceCharges(){
 const actor=await requirePermission("billing.view");
 const [patients,services,charges]=await Promise.all([
  can(actor,"billing.create")?prisma.patient.findMany({where:{archivedAt:null},select:{id:true,patientCode:true,fullName:true},orderBy:{fullName:"asc"},take:300}):Promise.resolve([]),
  prisma.service.findMany({where:{active:true},select:{id:true,name:true,price:true},orderBy:{name:"asc"}}),
  prisma.serviceCharge.findMany({orderBy:{createdAt:"desc"},take:100,include:{patient:{select:{fullName:true,patientCode:true}},service:{select:{name:true}}}}),
 ]);
 const pending=charges.filter(c=>c.status==="PENDING");
 return <div className="space-y-5"><div><h2 className="font-heading text-2xl font-semibold">Service charges</h2><p className="text-muted-foreground text-sm">Record a completed service, then post pending charges together on one invoice.</p></div>
 {can(actor,"billing.create")&&<form action={recordServiceCharge} className="surface-card flex flex-wrap items-end gap-3 p-4"><label>Patient<select name="patientId" required className="mt-1 block rounded border p-2"><option value="">Select patient</option>{patients.map(p=><option key={p.id} value={p.id}>{p.patientCode} · {p.fullName}</option>)}</select></label><label>Service<select name="serviceId" required className="mt-1 block rounded border p-2"><option value="">Select priced service</option>{services.map(s=><option key={s.id} value={s.id}>{s.name} · {s.price.toFixed(2)}</option>)}</select></label><label>Quantity<input name="quantity" type="number" min="1" max="100" defaultValue="1" required className="mt-1 block w-20 rounded border p-2"/></label><Button>Record completed service</Button></form>}
 {can(actor,"billing.create")&&pending.length>0&&<form action={postConsolidatedCharges} className="surface-card flex flex-wrap items-end gap-3 p-4"><input type="hidden" name="requestId" value={randomUUID()}/><label>Post pending charges for patient<select name="patientId" required className="mt-1 block rounded border p-2"><option value="">Select patient</option>{patients.filter(p=>pending.some(c=>c.patientId===p.id)).map(p=><option key={p.id} value={p.id}>{p.patientCode} · {p.fullName}</option>)}</select></label><Button>Post consolidated invoice</Button></form>}
 <section className="surface-card overflow-x-auto p-4"><table className="w-full text-left text-sm"><thead><tr><th>Patient</th><th>Service</th><th>Quantity</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{charges.map(c=><tr key={c.id} className="border-t"><td>{c.patient.patientCode} · {c.patient.fullName}</td><td>{c.service.name}</td><td>{c.quantity}</td><td>{c.amount.toFixed(2)}</td><td>{c.status}</td><td>{c.status==="PENDING"&&["ADMIN","SUPER_ADMIN"].includes(actor.role.name)&&<form action={voidPendingServiceCharge} className="flex gap-1"><input type="hidden" name="id" value={c.id}/><input name="reason" required minLength={3} placeholder="Void reason" aria-label="Void reason" className="rounded border p-1"/><Button size="sm" variant="outline">Void</Button></form>}</td></tr>)}</tbody></table></section></div>;
}
