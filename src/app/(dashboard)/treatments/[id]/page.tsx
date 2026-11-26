import {getClinicSettings} from "@/server/settings/queries";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  BadgePercent,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  FileText,
  History,
  NotebookPen,
  Pencil,
  ReceiptText,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { getTreatmentById } from "@/server/treatments/queries";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BackLink } from "@/components/shared/back-link";
import { ToothIcon } from "@/components/dental-chart/tooth-icon";
import { TreatmentStatusPill } from "@/components/treatments/treatments-table";
import { TreatmentActionBar, TreatmentHeaderMenu, TreatmentStatusSelect } from "@/components/treatments/treatment-detail-actions";
import { INVOICE_STATUS_STYLE } from "@/components/billing/invoice-status";
import { formatCurrency, formatDate, formatDateTime, formatTime, toNumber } from "@/lib/format";
import { toothName } from "@/lib/dental";
import { APPOINTMENT_TYPE_LABEL, INVOICE_STATUS_LABEL } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Treatment Details" };

export default async function TreatmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("treatments.view");
  const currency=(await getClinicSettings()).currency;
  const money=(value:unknown)=>formatCurrency(value,currency);
  const { id } = await params;
  const [treatment, activity] = await Promise.all([
    getTreatmentById(id),
    prisma.activityLog.findMany({
      where: { entityType: "Treatment", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, action: true, description: true, createdAt: true, user: { select: { name: true } } },
    }),
  ]);
  if (!treatment) notFound();

  const canManage = can(user, "treatments.edit");
  const canDelete = can(user, "treatments.delete");
  const canBill = can(user, "billing.create");
  const canViewBilling = can(user, "billing.view");
  const cost = toNumber(treatment.cost);
  const discount = toNumber(treatment.discount);
  const net = Math.max(0, cost - discount);
  const teeth = treatment.teeth.map((t) => t.tooth.toothNumber).sort((a, b) => a - b);
  // One invoice per treatment in practice; de-duplicate in case several items point at it.
  const invoices = [...new Map(treatment.invoiceItems.map((i) => [i.invoiceId, { ...i.invoice,status:i.invoice.voidedAt?"VOIDED":i.invoice.status, lineAmount: toNumber(i.amount) }])).values()];

  // Timeline: activity log entries plus the dates stored on the treatment itself.
  const timeline = [
    ...activity.map((a) => ({ id: a.id, at: a.createdAt, title: ACTION_LABEL[a.action] ?? a.action, text: a.description ?? "", by: a.user?.name ?? null })),
    ...(activity.some((a) => a.action === "CREATE")
      ? []
      : [{ id: "created", at: treatment.createdAt, title: "Created", text: `Treatment plan created for ${treatment.patient.fullName}.`, by: null }]),
    ...(treatment.completedAt && !activity.some((a) => a.action === "STATUS_CHANGE" && a.description?.includes("completed"))
      ? [{ id: "completed", at: treatment.completedAt, title: "Completed", text: "Treatment marked as completed.", by: null }]
      : []),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <BackLink href="/treatments" label="Back to Treatments" />

      {/* Header */}
      <section className="surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <span className="bg-pale text-brand flex size-16 shrink-0 items-center justify-center rounded-2xl" aria-hidden>
            <ToothIcon className="size-8" />
          </span>
          <div className="min-w-0">
            <Link href={`/patients/${treatment.patientId}`} className="text-muted-foreground hover:text-primary text-sm font-medium">
              {treatment.patient.fullName}
            </Link>
            <h2 className="font-heading text-navy truncate text-2xl font-semibold tracking-tight sm:text-[1.9rem]">{treatment.name}</h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <TreatmentStatusPill status={treatment.status} />
          {(canManage || canDelete) && <span className="bg-border mx-1 hidden h-8 w-px sm:block" aria-hidden />}
          {canManage && (
            <Button asChild variant="outline" size="lg" className="rounded-xl">
              <Link href={`/treatments/${treatment.id}/edit`}>
                <Pencil /> Edit Treatment
              </Link>
            </Button>
          )}
          {(canManage || canDelete) && (
            <TreatmentHeaderMenu id={treatment.id} name={treatment.name} status={treatment.status} canEdit={canManage} canDelete={canDelete} />
          )}
        </div>
      </section>

      {/* Overview + cost */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <section className="surface-card p-5 sm:p-6">
          <h3 className="text-navy border-border/70 border-b pb-4 text-lg font-semibold tracking-tight">Treatment Overview</h3>
          <div className="grid gap-4 py-5 sm:grid-cols-3 sm:divide-x sm:divide-border/70">
            <Fact icon={UserRound} label="Dentist" className="sm:pr-4">
              {treatment.dentist.name}
            </Fact>
            <Fact icon={CalendarDays} label="Start Date" className="sm:px-4">
              {treatment.startDate ? formatDate(treatment.startDate) : <Muted>Not set</Muted>}
            </Fact>
            <Fact icon={CalendarCheck2} label={treatment.completedAt ? "Completed" : "Expected Completion"} className="sm:pl-4">
              {treatment.completedAt
                ? formatDate(treatment.completedAt)
                : treatment.expectedCompletionDate
                  ? formatDate(treatment.expectedCompletionDate)
                  : <Muted>Not set</Muted>}
            </Fact>
          </div>
          <div className="border-border/70 border-t pt-5">
            <Fact icon={FileText} label="Description">
              <span className="font-medium whitespace-pre-line">{treatment.description || <Muted>No description added.</Muted>}</span>
            </Fact>
          </div>
        </section>

        <section className="surface-card p-5 sm:p-6">
          <h3 className="text-navy border-border/70 border-b pb-4 text-lg font-semibold tracking-tight">Cost Breakdown</h3>
          <dl className="mt-2">
            <CostRow icon={CircleDollarSign} label="Cost" value={money(cost)} />
            <CostRow icon={BadgePercent} label="Discount" value={discount ? `-${money(discount)}` : money(0)} />
          </dl>
          <div className="bg-pale mt-3 flex items-center gap-3 rounded-2xl px-4 py-3.5">
            <span className="text-brand flex size-10 items-center justify-center rounded-full bg-white" aria-hidden>
              <Wallet className="size-5" />
            </span>
            <span className="text-navy flex-1 text-lg font-semibold">Net Total</span>
            <span className="font-heading text-navy text-2xl font-semibold tabular-nums">{money(net)}</span>
          </div>
        </section>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="gap-4">
        <div className="surface-card overflow-x-auto px-3 pt-2 pb-1.5 sm:px-5">
          <TabsList variant="line" className="h-11!">
            <TabsTrigger value="details" className="px-4 text-[0.95rem]">
              Details
            </TabsTrigger>
            <TabsTrigger value="notes" className="px-4 text-[0.95rem]">
              Notes
            </TabsTrigger>
            <TabsTrigger value="invoices" className="px-4 text-[0.95rem]">
              Invoices {invoices.length > 0 && <Count n={invoices.length} />}
            </TabsTrigger>
            <TabsTrigger value="history" className="px-4 text-[0.95rem]">
              History {timeline.length > 0 && <Count n={timeline.length} />}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="details" className="grid items-start gap-5 lg:grid-cols-2">
          <Panel icon={ToothIcon} title="Affected Teeth">
            {teeth.length ? (
              <ul className="flex flex-wrap gap-2">
                {teeth.map((n) => (
                  <li key={n} className="bg-pale text-navy inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm" title={toothName(n)}>
                    <span className="bg-brand rounded-md px-1.5 py-0.5 text-xs font-semibold text-white tabular-nums">{n}</span>
                    {toothName(n)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">— No specific teeth selected</p>
            )}
          </Panel>
          <Panel icon={Activity} title="Treatment Status">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                {canManage ? <TreatmentStatusSelect id={treatment.id} status={treatment.status} /> : <TreatmentStatusPill status={treatment.status} />}
              </div>
              {treatment.appointment && (
                <Link
                  href={`/appointments/${treatment.appointment.id}`}
                  className="bg-muted/40 hover:bg-pale/70 flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
                >
                  <CalendarClock className="text-brand size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="text-navy block text-sm font-medium">
                      Linked appointment · {APPOINTMENT_TYPE_LABEL[treatment.appointment.type] ?? treatment.appointment.type}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(treatment.appointment.startTime)} at {formatTime(treatment.appointment.startTime)}
                    </span>
                  </span>
                </Link>
              )}
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="notes" className="grid items-start gap-5 lg:grid-cols-2">
          <Panel icon={NotebookPen} title="Treatment Notes">
            <p className={cn("leading-relaxed whitespace-pre-line", !treatment.description && "text-muted-foreground")}>
              {treatment.description || "No notes recorded for this treatment."}
            </p>
            {canManage && (
              <Link href={`/treatments/${treatment.id}/edit`} className="text-brand mt-3 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline">
                <Pencil className="size-3.5" aria-hidden /> Edit notes
              </Link>
            )}
          </Panel>
          <Panel icon={ClipboardList} title="Appointment Notes">
            <p className={cn("leading-relaxed whitespace-pre-line", !treatment.appointment?.notes && "text-muted-foreground")}>
              {treatment.appointment
                ? treatment.appointment.notes || "The linked appointment has no notes."
                : "This treatment isn't linked to an appointment."}
            </p>
          </Panel>
        </TabsContent>

        <TabsContent value="invoices">
          <Panel icon={ReceiptText} title="Invoices">
            {invoices.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-start gap-3">
                <p>No invoice has been created for this treatment yet.</p>
                {canBill && (
                  <Button asChild variant="outline" className="rounded-xl">
                    <Link href={`/billing/invoices/new?patientId=${treatment.patientId}&treatmentId=${treatment.id}`}>
                      <FileText /> Create Invoice
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <ul className="divide-border/60 divide-y">
                {invoices.map((inv) => {
                  const row = (
                    <>
                      <span className="bg-pale text-brand flex size-10 shrink-0 items-center justify-center rounded-xl" aria-hidden>
                        <ReceiptText className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-navy block font-semibold">{inv.invoiceNumber}</span>
                        <span className="text-muted-foreground text-xs">
                          {formatDate(inv.date)} · this treatment {money(inv.lineAmount)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ring-inset",
                          INVOICE_STATUS_STYLE[inv.status] ?? INVOICE_STATUS_STYLE.UNPAID
                        )}
                      >
                        {INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                      </span>
                      <span className="text-navy w-24 text-right font-semibold tabular-nums">{money(inv.total)}</span>
                    </>
                  );
                  return (
                    <li key={inv.id}>
                      {canViewBilling ? (
                        <Link href={`/billing/invoices/${inv.id}`} className="hover:bg-pale/40 -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors">
                          {row}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 py-3">{row}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="history">
          <Panel icon={History} title="History">
            {timeline.length === 0 ? (
              <p className="text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <ol className="relative ml-2 border-l border-[#d6e6f2]">
                {timeline.map((e) => (
                  <li key={e.id} className="relative pb-5 pl-6 last:pb-0">
                    <span className="bg-brand absolute top-1.5 -left-[5px] size-2.5 rounded-full ring-4 ring-white" aria-hidden />
                    <p className="text-navy font-semibold">{e.title}</p>
                    {e.text && <p className="text-foreground/75 text-sm">{e.text}</p>}
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {formatDateTime(e.at)}
                      {e.by && ` · ${e.by}`}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      <TreatmentActionBar
        id={treatment.id}
        status={treatment.status}
        patientId={treatment.patientId}
        invoiceId={invoices[0]?.id ?? null}
        canManage={canManage}
        canBill={canBill}
      />
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  CREATE: "Created",
  UPDATE: "Updated",
  STATUS_CHANGE: "Status changed",
  DELETE: "Deleted",
};

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground font-normal">{children}</span>;
}

function Count({ n }: { n: number }) {
  return <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">{n}</span>;
}

function Fact({ icon: Icon, label, children, className }: { icon: LucideIcon; label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <span className="bg-pale text-brand flex size-12 shrink-0 items-center justify-center rounded-full" aria-hidden>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <div className="text-navy truncate text-[0.95rem] font-semibold">{children}</div>
      </div>
    </div>
  );
}

function CostRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="border-border/60 flex items-center gap-3 border-b px-1 py-3 last:border-0">
      <span className="bg-pale text-brand flex size-10 items-center justify-center rounded-full" aria-hidden>
        <Icon className="size-[1.1rem]" />
      </span>
      <dt className="text-foreground/80 flex-1">{label}</dt>
      <dd className="text-navy text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Panel({ icon: Icon, title, children }: { icon: LucideIcon | typeof ToothIcon; title: string; children: ReactNode }) {
  return (
    <section className="surface-card p-5 sm:p-6">
      <h3 className="text-navy border-border/70 mb-4 flex items-center gap-3 border-b pb-4 text-lg font-semibold tracking-tight">
        <span className="bg-pale text-brand flex size-9 items-center justify-center rounded-full" aria-hidden>
          <Icon className="size-[1.1rem]" />
        </span>
        {title}
      </h3>
      <div className="text-sm">{children}</div>
    </section>
  );
}
