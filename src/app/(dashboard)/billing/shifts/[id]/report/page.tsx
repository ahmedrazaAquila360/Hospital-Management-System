import Link from "next/link";
import {notFound} from "next/navigation";
import {requirePermission} from "@/lib/auth/guard";
import {can} from "@/lib/permissions";
import {prisma} from "@/lib/prisma";
import {formatCurrency,formatDateTime} from "@/lib/format";

export const metadata={title:"Cashier close report"};
export default async function CashierCloseReport({params}:{params:Promise<{id:string}>}){
 const actor=await requirePermission("billing.shifts");
 const {id}=await params;
 const manager=can(actor,"billing.shiftApprove")&&["ADMIN","SUPER_ADMIN"].includes(actor.role.name);
 const shift=await prisma.cashierShift.findFirst({where:{id,...(manager?{}:{cashierId:actor.id})},include:{cashier:{select:{name:true}},payments:{include:{invoice:{select:{invoiceNumber:true}},receivedBy:{select:{name:true}}},orderBy:{date:"asc"}}}});
 if(!shift)notFound();
 const hospital=await prisma.clinicSettings.findFirst({select:{clinicName:true,currency:true}});
 const money=(value:unknown)=>formatCurrency(value,hospital?.currency??"USD");
 const methods=["CASH","CARD","BANK_TRANSFER","INSURANCE","OTHER"] as const;
 return <main className="mx-auto max-w-3xl space-y-5 bg-white p-8 text-black print:p-0"><header className="border-b pb-4"><h1 className="text-2xl font-semibold">{hospital?.clinicName??"Hospital"}</h1><h2 className="text-xl">Cashier reconciliation</h2><p>{shift.cashier.name} · Opened {formatDateTime(shift.openedAt)} · {shift.status}</p></header><dl className="grid grid-cols-2 gap-3"><div>Opening cash: {money(shift.openingCash)}</div><div>Expected closing cash: {shift.expectedCash?money(shift.expectedCash):"Pending"}</div><div>Counted cash: {shift.countedCash?money(shift.countedCash):"Pending"}</div><div>Discrepancy: {shift.discrepancy?money(shift.discrepancy):"Pending"}</div></dl><section><h3 className="font-semibold">Payment method totals</h3><ul>{methods.map(method=><li key={method}>{method}: {money(shift.payments.filter(p=>p.method===method).reduce((sum,p)=>sum.plus(p.amount),shift.openingCash.mul(0)))}</li>)}</ul></section><table className="w-full text-left text-sm"><thead><tr><th>Date</th><th>Invoice</th><th>Method</th><th>Recorded by</th><th className="text-right">Amount</th></tr></thead><tbody>{shift.payments.map(p=><tr key={p.id} className="border-t"><td>{formatDateTime(p.date)}</td><td>{p.invoice.invoiceNumber}</td><td>{p.method}</td><td>{p.receivedBy?.name??"—"}</td><td className="text-right">{money(p.amount)}</td></tr>)}</tbody></table><p className="print:hidden"><Link href="/billing/shifts" className="underline">Back to shifts</Link> · Use your browser’s Print command for a paper or PDF report.</p></main>;
}
