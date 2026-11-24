import {notFound} from "next/navigation";
import Link from "next/link";
import {requirePermission} from "@/lib/auth/guard";
import {prisma} from "@/lib/prisma";
import {formatCurrency,formatDateTime} from "@/lib/format";

export const metadata={title:"Payment receipt"};
export default async function PaymentReceipt({params}:{params:Promise<{id:string}>}){
 await requirePermission("billing.view");
 const {id}=await params;
 const [payment,hospital]=await Promise.all([
  prisma.payment.findUnique({where:{id},include:{invoice:{select:{invoiceNumber:true}},patient:{select:{fullName:true,patientCode:true}},receivedBy:{select:{name:true}}}}),
  prisma.clinicSettings.findFirst({select:{clinicName:true,address:true,phone:true,registrationNumber:true,currency:true}}),
 ]);
 if(!payment)notFound();
 const money=(value:unknown)=>formatCurrency(value,hospital?.currency??"USD");
 return <main className="mx-auto max-w-2xl space-y-6 bg-white p-8 text-black print:p-0"><header className="border-b pb-4"><h1 className="text-2xl font-semibold">{hospital?.clinicName??"Hospital"}</h1><p>{hospital?.address}</p><p>{hospital?.phone}</p>{hospital?.registrationNumber&&<p>Registration: {hospital.registrationNumber}</p>}</header><h2 className="text-xl font-semibold">{payment.amount.lt(0)?"Refund record":"Payment receipt"}</h2><dl className="grid grid-cols-2 gap-4"><div><dt>Receipt reference</dt><dd className="font-mono">{payment.id}</dd></div><div><dt>Date</dt><dd>{formatDateTime(payment.date)}</dd></div><div><dt>Invoice</dt><dd>{payment.invoice.invoiceNumber}</dd></div><div><dt>Patient</dt><dd>{payment.patient.fullName} · {payment.patient.patientCode}</dd></div><div><dt>Method</dt><dd>{payment.method}</dd></div><div><dt>Recorded by</dt><dd>{payment.receivedBy?.name??"—"}</dd></div>{payment.reference&&<div><dt>Reference</dt><dd>{payment.reference}</dd></div>}</dl><p className="border-t pt-4 text-xl font-semibold">Amount: {money(payment.amount.abs())}</p><p className="print:hidden"><Link href="/billing/payments" className="underline">Back to payments</Link> · Use your browser’s Print command for a paper or PDF receipt.</p></main>;
}
