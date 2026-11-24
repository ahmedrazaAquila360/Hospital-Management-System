import Link from "next/link";
import {requirePermission} from "@/lib/auth/guard";
import {can} from "@/lib/permissions";
import {prisma} from "@/lib/prisma";
import {Button} from "@/components/ui/button";
import {requestFinancialApproval,decideFinancialApproval} from "@/server/billing/approvals";

export const metadata={title:"Financial approvals"};
export default async function FinancialApprovals(){
 const actor=await requirePermission("billing.view");
 const [requests,invoices]=await Promise.all([
  prisma.financialApproval.findMany({orderBy:{requestedAt:"desc"},take:100,include:{invoice:{select:{invoiceNumber:true,patient:{select:{patientCode:true}}}}}}),
  prisma.invoice.findMany({where:{status:{in:["UNPAID","PARTIALLY_PAID","PAID"]}},select:{id:true,invoiceNumber:true,total:true,patient:{select:{patientCode:true}}},orderBy:{date:"desc"},take:200}),
 ]);
 const users=await prisma.user.findMany({where:{id:{in:requests.map(r=>r.requestedById)}},select:{id:true,name:true}});
 const names=new Map(users.map(u=>[u.id,u.name]));
 const canRequestDiscount=can(actor,"billing.create");const canRequestRefund=can(actor,"billing.payments");
 const canApprove=["ADMIN","SUPER_ADMIN"].includes(actor.role.name);
 return <div className="space-y-5"><div><h2 className="font-heading text-2xl font-semibold">Financial approvals</h2><p className="text-muted-foreground text-sm">Request a discount or refund with a reason. Another authorized administrator must review and apply it. Threshold policy awaits operator approval.</p></div>
 {(canRequestDiscount||canRequestRefund)&&<form action={requestFinancialApproval} className="surface-card flex flex-wrap items-end gap-3 p-4"><label>Invoice<select name="invoiceId" required className="mt-1 block rounded border p-2"><option value="">Select invoice</option>{invoices.map(i=><option key={i.id} value={i.id}>{i.invoiceNumber} · {i.patient.patientCode} · {i.total.toFixed(2)}</option>)}</select></label><label>Request type<select name="kind" className="mt-1 block rounded border p-2">{canRequestDiscount&&<option value="DISCOUNT">Discount</option>}{canRequestRefund&&<option value="REFUND">Refund</option>}</select></label><label>Amount<input name="amount" type="number" min="0.01" step="0.01" required className="mt-1 block rounded border p-2"/></label><label>Refund method<select name="method" className="mt-1 block rounded border p-2"><option value="CASH">Cash</option><option value="CARD">Card</option><option value="BANK_TRANSFER">Bank transfer</option><option value="INSURANCE">Insurance</option><option value="OTHER">Other</option></select></label><label>Reason<input name="reason" minLength={3} required maxLength={500} className="mt-1 block rounded border p-2"/></label><Button>Submit request</Button></form>}
 <section className="surface-card overflow-x-auto p-4"><table className="w-full text-left text-sm"><thead><tr><th>Invoice</th><th>Kind</th><th>Amount</th><th>Reason</th><th>Requested by</th><th>Status</th><th>Decision</th></tr></thead><tbody>{requests.map(r=><tr key={r.id} className="border-t align-top"><td className="py-3"><Link href={`/billing/invoices/${r.invoiceId}`} className="underline">{r.invoice.invoiceNumber}</Link> · {r.invoice.patient.patientCode}</td><td>{r.kind}</td><td>{r.amount.toFixed(2)}</td><td>{r.reason}</td><td>{names.get(r.requestedById)??"Unknown"}</td><td>{r.status}</td><td>{canApprove&&r.status==="REQUESTED"&&r.requestedById!==actor.id&&<form action={decideFinancialApproval} className="flex gap-1"><input type="hidden" name="id" value={r.id}/><input name="reason" aria-label="Decision reason" placeholder="Decision note" className="rounded border p-1"/><Button name="decision" value="APPROVE" size="sm">Approve</Button><Button name="decision" value="REJECT" size="sm" variant="outline">Reject</Button></form>}</td></tr>)}</tbody></table></section></div>;
}
