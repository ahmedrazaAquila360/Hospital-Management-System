import Link from "next/link";
import {requirePermission} from "@/lib/auth/guard";
import {can} from "@/lib/permissions";
import {prisma} from "@/lib/prisma";
import {runGuardianScan,reviewGuardianAlert} from "@/server/revenue-guardian/actions";
import {Button} from "@/components/ui/button";
export default async function RevenueGuardian(){
 const actor=await requirePermission("billing.guardian");
 const alerts=await prisma.revenueAlert.findMany({orderBy:{createdAt:"desc"},take:100,include:{patient:{select:{patientCode:true}}}});
 return <div className="space-y-5"><div className="flex items-center justify-between"><div><h2 className="font-heading text-2xl font-semibold">Revenue Guardian</h2><p className="text-muted-foreground text-sm">Explainable exceptions for this branch. Reviewing does not post a charge.</p></div>{can(actor,"billing.guardianManage")&&<form action={runGuardianScan}><Button>Scan records</Button></form>}</div>
 <div className="surface-card overflow-x-auto p-4"><table className="w-full text-left text-sm"><thead><tr><th>Rule</th><th>Patient</th><th>Evidence</th><th>Impact</th><th>Status</th><th>Review</th></tr></thead><tbody>{alerts.map(a=><tr key={a.id} className="border-t align-top"><td className="py-3">{a.rule.replaceAll('_',' ')}</td><td>{a.patient?.patientCode??'Unavailable'}</td><td className="max-w-xs break-words">{JSON.stringify(a.evidence)}</td><td>{a.impact?.toFixed(2)??'Not determinable'}</td><td>{a.status}</td><td>{a.status!=="RESOLVED"&&<form action={reviewGuardianAlert} className="flex gap-1"><input type="hidden" name="id" value={a.id}/><input name="reason" aria-label="Review or dismissal reason" placeholder="Reason" className="w-24 rounded border p-1"/><Button size="sm" name="status" value="REVIEWED">Review</Button><Button size="sm" variant="outline" name="status" value="DISMISSED">Dismiss</Button></form>}</td></tr>)}</tbody></table>{!alerts.length&&<p>No exceptions recorded. Run a scan to check persisted records.</p>}</div><Link href="/billing/invoices" className="underline">Invoices</Link></div>;
}
