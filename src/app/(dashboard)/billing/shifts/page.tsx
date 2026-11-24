import {requirePermission} from "@/lib/auth/guard";
import {can} from "@/lib/permissions";
import {prisma} from "@/lib/prisma";
import {Button} from "@/components/ui/button";
import {openCashierShift,submitCashierShift,approveCashierShift} from "@/server/billing/shifts";

export const metadata={title:"Cashier shifts"};
export default async function CashierShifts(){
 const actor=await requirePermission("billing.shifts");
 const canApprove=can(actor,"billing.shiftApprove")&&["ADMIN","SUPER_ADMIN"].includes(actor.role.name);
 const shifts=await prisma.cashierShift.findMany({where:canApprove?{}:{cashierId:actor.id},include:{cashier:{select:{name:true}},payments:{select:{amount:true,method:true}}},orderBy:{openedAt:"desc"},take:50});
 const ownOpen=shifts.find(s=>s.cashierId===actor.id&&s.status==="OPEN");
 return <div className="space-y-5"><div><h2 className="font-heading text-2xl font-semibold">Cashier shifts</h2><p className="text-muted-foreground text-sm">Cash reconciliation from posted payments. Closing policy awaits operator approval.</p></div>
 {!ownOpen&&<form action={openCashierShift} className="surface-card flex items-end gap-3 p-4"><label>Opening cash<input name="openingCash" type="number" min="0" step="0.01" required className="mt-1 block rounded border p-2"/></label><Button>Open shift</Button></form>}
 {ownOpen&&<form action={submitCashierShift} className="surface-card flex items-end gap-3 p-4"><input type="hidden" name="id" value={ownOpen.id}/><label>Counted cash<input name="countedCash" type="number" min="0" step="0.01" required className="mt-1 block rounded border p-2"/></label><Button>Submit close</Button></form>}
 <div className="surface-card overflow-x-auto p-4"><table className="w-full text-left text-sm"><thead><tr><th>Cashier</th><th>Opened</th><th>Status</th><th>Opening</th><th>Cash movements</th><th>Expected</th><th>Counted</th><th>Difference</th><th>Review</th></tr></thead><tbody>{shifts.map(s=><tr key={s.id} className="border-t"><td>{s.cashier.name}</td><td>{s.openedAt.toISOString()}</td><td>{s.status}</td><td>{s.openingCash.toFixed(2)}</td><td>{s.payments.filter(p=>p.method==="CASH").reduce((n,p)=>n.plus(p.amount),s.openingCash.mul(0)).toFixed(2)}</td><td>{s.expectedCash?.toFixed(2)??"—"}</td><td>{s.countedCash?.toFixed(2)??"—"}</td><td>{s.discrepancy?.toFixed(2)??"—"}</td><td>{canApprove&&s.status==="SUBMITTED"&&<form action={approveCashierShift} className="flex gap-1"><input type="hidden" name="id" value={s.id}/><input name="reason" aria-label="Discrepancy explanation" placeholder="Reason if discrepant" className="rounded border p-1"/><Button size="sm">Approve</Button></form>}</td></tr>)}</tbody></table></div></div>;
}
