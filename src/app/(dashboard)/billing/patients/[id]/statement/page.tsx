import Link from "next/link";
import {notFound} from "next/navigation";
import {requirePermission} from "@/lib/auth/guard";
import {prisma} from "@/lib/prisma";
import {formatCurrency,formatDateTime} from "@/lib/format";
import {Prisma} from "@/generated/prisma/client";

export const metadata={title:"Patient billing statement"};
export default async function PatientBillingStatement({params}:{params:Promise<{id:string}>}){
 await requirePermission("billing.view");
 const {id}=await params;
 const [patient,invoices,hospital]=await Promise.all([
  prisma.patient.findUnique({where:{id},select:{id:true,fullName:true,patientCode:true}}),
  prisma.invoice.findMany({where:{patientId:id},include:{items:true,payments:true},orderBy:{date:"asc"}}),
  prisma.clinicSettings.findFirst({select:{clinicName:true,address:true,phone:true,registrationNumber:true,currency:true}}),
 ]);
 if(!patient)notFound();
 const money=(value:unknown)=>formatCurrency(value,hospital?.currency??"USD");
 const total=invoices.reduce((sum,i)=>sum.plus(i.total),new Prisma.Decimal(0));
 const paid=invoices.flatMap(i=>i.payments).reduce((sum,p)=>sum.plus(p.amount),new Prisma.Decimal(0));
 return <main className="mx-auto max-w-4xl space-y-5 bg-white p-8 text-black print:p-0"><header className="border-b pb-4"><h1 className="text-2xl font-semibold">{hospital?.clinicName??"Hospital"}</h1><p>{hospital?.address} {hospital?.phone}</p>{hospital?.registrationNumber&&<p>Registration: {hospital.registrationNumber}</p>}<h2 className="mt-3 text-xl font-semibold">Consolidated patient statement</h2><p>{patient.fullName} · {patient.patientCode}</p></header><p className="text-sm">This statement combines invoices and payments in the active branch; original invoice records remain separate.</p><table className="w-full text-left text-sm"><thead><tr><th>Posted</th><th>Invoice</th><th>Services</th><th className="text-right">Total</th><th className="text-right">Paid</th><th className="text-right">Balance</th></tr></thead><tbody>{invoices.map(i=>{const sum=i.payments.reduce((n,p)=>n.plus(p.amount),new Prisma.Decimal(0));return <tr key={i.id} className="border-t align-top"><td>{formatDateTime(i.date)}</td><td>{i.invoiceNumber}</td><td>{i.items.map(item=>`${item.description} × ${item.quantity}`).join("; ")}</td><td className="text-right">{money(i.total)}</td><td className="text-right">{money(sum)}</td><td className="text-right">{money(i.total.minus(sum))}</td></tr>})}</tbody><tfoot><tr className="border-t-2 font-semibold"><td colSpan={3}>Total</td><td className="text-right">{money(total)}</td><td className="text-right">{money(paid)}</td><td className="text-right">{money(total.minus(paid))}</td></tr></tfoot></table><p className="print:hidden"><Link href="/billing/invoices" className="underline">Back to invoices</Link> · Use your browser’s Print command for paper or PDF.</p></main>;
}
