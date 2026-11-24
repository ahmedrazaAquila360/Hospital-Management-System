import Link from "next/link";
import {requirePermission} from "@/lib/auth/guard";
import {can} from "@/lib/permissions";
import {prisma} from "@/lib/prisma";
import {getGuardianConfig} from "@/server/revenue-guardian/config";
import {runGuardianScan,reviewGuardianAlert,saveGuardianConfig} from "@/server/revenue-guardian/actions";
import {Button} from "@/components/ui/button";
import {guardianReviewers} from "@/server/revenue-guardian/reviewers";
function sourceHref(rule:string,id:string){
 if(rule==="RELEASED_LAB_UNBILLED")return `/laboratory/${id}/print`;
 if(rule==="COMPLETED_CONSULTATION_UNBILLED")return `/appointments/${id}`;
 if(rule==="DISCHARGED_UNBILLED")return "/admissions";
 if(rule==="SERVICE_CHARGE_UNBILLED")return "/billing/service-charges";
 if(rule==="DISCOUNT_REVIEW")return `/billing/invoices/${id}`;
 if(rule==="REFUND_REVIEW")return "/billing/payments";
 if(rule==="DISPENSE_BILL_MISMATCH")return "/pharmacy";
 return "/billing/invoices";
}
export default async function RevenueGuardian(){
 const actor=await requirePermission("billing.guardian");
 const config=await getGuardianConfig();
 const reviewers=await guardianReviewers();
 const alerts=await prisma.revenueAlert.findMany({orderBy:{createdAt:"desc"},take:100,include:{patient:{select:{patientCode:true}}}});
 const reviews=await prisma.activityLog.findMany({where:{entityType:"RevenueAlert",entityId:{in:alerts.map(a=>a.id)}},orderBy:{createdAt:"desc"},take:300,select:{entityId:true,action:true,createdAt:true,metadata:true,user:{select:{name:true}}}});
 const history=new Map(alerts.map(a=>[a.id,reviews.filter(r=>r.entityId===a.id)]));
 return <div className="space-y-5"><div className="flex items-center justify-between"><div><h2 className="font-heading text-2xl font-semibold">Revenue Guardian</h2><p className="text-muted-foreground text-sm">Explainable exceptions for this branch. Reviewing does not post a charge.</p></div>{can(actor,"billing.guardianManage")&&<form action={runGuardianScan}><Button>Scan records</Button></form>}</div>
 {can(actor,"billing.guardianManage")&&<form action={saveGuardianConfig} className="surface-card flex flex-wrap items-end gap-3 p-4"><label><input type="checkbox" name="enabled" defaultChecked={config.enabled}/> Scan enabled</label><label>Discount amount<input className="block rounded border p-1" name="discountAmount" type="number" min="0" step="0.01" defaultValue={config.discountAmount??""}/></label><label>Discount %<input className="block rounded border p-1" name="discountPercent" type="number" min="0" max="100" step="0.01" defaultValue={config.discountPercent??""}/></label><label>Refund amount<input className="block rounded border p-1" name="refundAmount" type="number" min="0" step="0.01" defaultValue={config.refundAmount??""}/></label><Button variant="outline">Save rules</Button><span className="text-sm text-muted-foreground">Thresholds await hospital operator approval.</span></form>}
 <div className="surface-card overflow-x-auto p-4"><table className="w-full text-left text-sm"><thead><tr><th>Rule</th><th>Patient</th><th>Evidence</th><th>Impact</th><th>Status</th><th>Review</th></tr></thead><tbody>{alerts.map(a=><tr key={a.id} className="border-t align-top"><td className="py-3">{a.rule.replaceAll('_',' ')}<Link href={sourceHref(a.rule,a.sourceId)} className="mt-1 block text-xs underline">Open source</Link></td><td>{a.patient?.patientCode??'Unavailable'}</td><td className="max-w-xs break-words">{JSON.stringify(a.evidence)}</td><td>{a.impact?.toFixed(2)??'Not determinable'}</td><td>{a.status}<p className="text-xs">Assigned: {reviewers.find(u=>u.id===a.assignedToId)?.name??"Unassigned"}</p>{(history.get(a.id)?.length??0)>0&&<details className="mt-1 text-xs"><summary>History</summary>{history.get(a.id)?.map((r,i)=><p key={i}>{r.createdAt.toISOString()} · {r.user?.name??"System"} · {r.action} · {JSON.stringify(r.metadata)}</p>)}</details>}</td><td>{a.status!=="RESOLVED"&&<form action={reviewGuardianAlert} className="flex gap-1"><input type="hidden" name="id" value={a.id}/><select name="assigneeId" aria-label="Assign reviewer" defaultValue={a.assignedToId??""} className="rounded border p-1"><option value="">Unassigned</option>{reviewers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select><input name="reason" aria-label="Review or dismissal reason" placeholder="Reason" className="w-24 rounded border p-1"/><Button size="sm" name="status" value="REVIEWED">Review</Button><Button size="sm" variant="outline" name="status" value="DISMISSED">Dismiss</Button></form>}</td></tr>)}</tbody></table>{!alerts.length&&<p>No exceptions recorded. Run a scan to check persisted records.</p>}</div><Link href="/billing/invoices" className="underline">Invoices</Link></div>;
}
