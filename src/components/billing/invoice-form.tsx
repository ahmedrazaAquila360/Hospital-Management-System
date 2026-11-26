"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { FileText, Layers, NotebookPen, Plus, Receipt, Stethoscope, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { PatientCombobox } from "@/components/shared/patient-combobox";
import { ErrorSummary, FormSection, RequiredMark, SubmitButton } from "@/components/shared/record-form";
import { submitWithoutReset } from "@/lib/form-submit";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InvoiceFormState } from "@/server/billing/actions";
import type { Patient } from "@/generated/prisma/client";
import type { SafeUser } from "@/lib/safe-user";

// Quantities/prices are kept as the raw input text so an emptied box doesn't become NaN
// (previously cleared fields showed "NaN" totals); `num` turns them into numbers for maths.
type ItemRow = { key: number; description: string; quantity: string; unitPrice: string; treatmentId?: string };
type Mode = "amount" | "percent";

const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

function ModeToggle({ value, onChange, label,currency }: { value: Mode; onChange: (m: Mode) => void; label: string;currency:string }) {
  return (
    <div className="bg-muted/80 flex rounded-lg p-0.5" role="group" aria-label={`${label} type`}>
      {(["amount", "percent"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={value === m}
          onClick={() => onChange(m)}
          className={cn(
            "h-7 w-8 cursor-pointer rounded-md text-xs font-semibold transition-colors",
            value === m ? "bg-brand text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {m === "amount" ? currency : "%"}
        </button>
      ))}
    </div>
  );
}

export function InvoiceForm({
  currency,
  action,
  dentists,
  defaultPatient,
  services,
  defaultItem,
}: {
  currency:string;
  action: (state: InvoiceFormState, formData: FormData) => Promise<InvoiceFormState>;
  dentists: Pick<SafeUser, "id" | "name">[];
  services: { name: string; price: string }[];
  defaultPatient?: Pick<Patient,"id"|"phone"|"patientCode"|"fullName"> | null;
  defaultItem?: { description: string; unitPrice: number; treatmentId: string };
}) {
  const money=(value:unknown)=>formatCurrency(value,currency);
  const [state, formAction] = useActionState(action, {});
  const requestId = useRef<string>("");
  const [rows, setRows] = useState<ItemRow[]>(
    defaultItem
      ? [{ key: 0, description: defaultItem.description, quantity: "1", unitPrice: String(defaultItem.unitPrice), treatmentId: defaultItem.treatmentId }]
      : [{ key: 0, description: "", quantity: "1", unitPrice: "" }]
  );
  const nextKey = useRef(1);
  const focusKey = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [dentistId, setDentistId] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [discountMode, setDiscountMode] = useState<Mode>("amount");
  const [taxInput, setTaxInput] = useState("");
  const [taxMode, setTaxMode] = useState<Mode>("amount");
  const [patientMissing, setPatientMissing] = useState(false);

  // Same formula as the server action: total = max(0, subtotal - discount + tax).
  // "%" is converted to an amount here; the server still receives amounts, as before.
  const subtotal = round2(rows.reduce((sum, r) => sum + Math.floor(num(r.quantity)) * num(r.unitPrice), 0));
  const discount = round2(discountMode === "percent" ? (subtotal * Math.min(num(discountInput), 100)) / 100 : num(discountInput));
  const taxBase = Math.max(0, subtotal - discount);
  const tax = round2(taxMode === "percent" ? (taxBase * num(taxInput)) / 100 : num(taxInput));
  const total = Math.max(0, round2(subtotal - discount + tax));
  const discountTooBig = discount > subtotal && subtotal > 0;

  useEffect(() => {
    if (focusKey.current === null) return;
    listRef.current?.querySelector<HTMLInputElement>(`#item-${focusKey.current}-desc`)?.focus();
    focusKey.current = null;
  }, [rows]);

  function updateRow(key: number, patch: Partial<ItemRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addRow() {
    const key = nextKey.current++;
    focusKey.current = key;
    setRows((rs) => [...rs, { key, description: "", quantity: "1", unitPrice: "" }]);
  }
  function removeRow(key: number) {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));
  }

  const submit = submitWithoutReset(formAction);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    requestId.current ||= crypto.randomUUID();
    const token = event.currentTarget.elements.namedItem("requestId") as HTMLInputElement;
    token.value = requestId.current;
    if (!new FormData(event.currentTarget).get("patientId")) {
      event.preventDefault();
      setPatientMissing(true);
      return;
    }
    submit(event);
  }

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]"
    >
      <input type="hidden" name="requestId" defaultValue="" />
      {/* Amounts the server action reads. */}
      <input type="hidden" name="discount" value={discount} />
      <input type="hidden" name="tax" value={tax} />
      <input type="hidden" name="dentistId" value={dentistId} />

      <div className="flex min-w-0 flex-col gap-6">
        <div className="surface-card @container overflow-hidden p-0">
          <ErrorSummary message={state.error} trigger={state} />
          <FormSection icon={FileText} title="Invoice Details">
            <div className="grid grid-cols-1 gap-5 @xl:grid-cols-2">
              <Field data-invalid={patientMissing || undefined}>
                <FieldLabel>
                  Patient <RequiredMark />
                </FieldLabel>
                <div className="[&_[role=combobox]]:h-11">
                  <PatientCombobox name="patientId" defaultPatient={defaultPatient} onSelect={() => setPatientMissing(false)} />
                </div>
                <FieldError>{patientMissing ? "Select a patient" : undefined}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="inv-dentist">Dentist (optional)</FieldLabel>
                <div className="relative">
                  <Stethoscope className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2" aria-hidden />
                  <Select value={dentistId} onValueChange={setDentistId}>
                    <SelectTrigger id="inv-dentist" className="h-11! w-full pl-10">
                      <SelectValue placeholder="Select dentist" />
                    </SelectTrigger>
                    <SelectContent>
                      {dentists.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Field>
            </div>
          </FormSection>
        </div>

        <div className="surface-card @container overflow-hidden p-0">
          <section className="px-5 py-6 sm:px-7">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-navy flex items-center gap-2.5 text-lg font-semibold tracking-tight">
                  <Layers className="text-brand size-5" aria-hidden /> Line Items
                </h3>
                <p className="text-muted-foreground mt-0.5 text-sm">Treatments, procedures or services on this invoice.</p>
              </div>
              <Button type="button" variant="outline" onClick={addRow} className="shrink-0">
                <Plus /> Add Item
              </Button>
            </div>

            {services.length > 0 && <label className="mb-3 block">Add hospital service<select className="ml-2 rounded border p-2" value="" onChange={e => {
              const service = services.find(s=>s.name===e.target.value);
              if (service) setRows(previous => [...previous.filter(r=>r.description || r.unitPrice), { key: nextKey.current++, quantity: "1", description: service.name, unitPrice: service.price }]);
            }}><option value="">Select service</option>{services.map(s=><option key={s.name}>{s.name}</option>)}</select></label>}
            <div ref={listRef} className="border-border/80 overflow-hidden rounded-2xl border">
              <div className="bg-muted/50 text-muted-foreground hidden grid-cols-[minmax(0,1fr)_5rem_7.5rem_6.5rem_2.5rem] gap-3 px-4 py-2.5 text-xs font-semibold @2xl:grid">
                <span>
                  Description <RequiredMark />
                </span>
                <span>
                  Qty <RequiredMark />
                </span>
                <span>
                  Unit Price <RequiredMark />
                </span>
                <span className="text-right">Amount</span>
                <span />
              </div>
              <ul className="divide-border/60 divide-y">
                {rows.map((row, i) => (
                  <li
                    key={row.key}
                    className="grid grid-cols-2 items-center gap-3 p-4 @2xl:grid-cols-[minmax(0,1fr)_5rem_7.5rem_6.5rem_2.5rem] @2xl:py-3"
                  >
                    {/* One value per row (empty if none): the server pairs these with items by position. */}
                    <input type="hidden" name="itemTreatmentId" value={row.treatmentId ?? ""} />
                    <div className="col-span-2 @2xl:col-span-1">
                      <label htmlFor={`item-${row.key}-desc`} className="text-muted-foreground mb-1 block text-xs @2xl:sr-only">
                        Description of item {i + 1}
                      </label>
                      <Input
                        id={`item-${row.key}-desc`}
                        name="itemDescription"
                        value={row.description}
                        onChange={(e) => updateRow(row.key, { description: e.target.value })}
                        placeholder="Service or procedure"
                        className="h-10"
                        autoComplete="off"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor={`item-${row.key}-qty`} className="text-muted-foreground mb-1 block text-xs @2xl:sr-only">
                        Quantity
                      </label>
                      <Input
                        id={`item-${row.key}-qty`}
                        name="itemQuantity"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        value={row.quantity}
                        onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                        className="h-10 tabular-nums"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor={`item-${row.key}-price`} className="text-muted-foreground mb-1 block text-xs @2xl:sr-only">
                        Unit price
                      </label>
                      <Input
                        id={`item-${row.key}-price`}
                        name="itemUnitPrice"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={row.unitPrice}
                        placeholder="0.00"
                        onChange={(e) => updateRow(row.key, { unitPrice: e.target.value })}
                        className="h-10 tabular-nums"
                        required
                      />
                    </div>
                    <p className="text-navy text-sm font-semibold tabular-nums @2xl:text-right">
                      <span className="text-muted-foreground mr-1 text-xs font-normal @2xl:hidden">Amount</span>
                      {money(Math.floor(num(row.quantity)) * num(row.unitPrice))}
                    </p>
                    <div className="flex justify-end">
                      {rows.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRow(row.key)}
                          className="text-destructive bg-destructive/10 hover:bg-destructive size-9 rounded-xl hover:text-white"
                          aria-label={`Remove item ${i + 1}`}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <div className="surface-card overflow-hidden p-0">
          <FormSection icon={NotebookPen} title="Notes">
            <Field>
              <FieldLabel htmlFor="inv-notes" className="sr-only">
                Notes
              </FieldLabel>
              <Textarea id="inv-notes" name="notes" rows={3} placeholder="Add any additional notes (optional)…" />
            </Field>
          </FormSection>
        </div>
      </div>

      <aside className="surface-card overflow-hidden p-0 xl:sticky xl:top-24">
        <div className="bg-pale/60 border-border/70 flex items-center gap-3 border-b px-5 py-4">
          <span className="bg-card text-brand flex size-10 items-center justify-center rounded-xl shadow-xs" aria-hidden>
            <Receipt className="size-5" />
          </span>
          <div>
            <h3 className="text-navy font-semibold">Invoice Summary</h3>
            <p className="text-muted-foreground text-xs">Updates as you edit line items.</p>
          </div>
        </div>
        <div className="space-y-4 px-5 py-5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-foreground/80 font-medium">Subtotal</span>
            <span className="text-navy font-semibold tabular-nums">{money(subtotal)}</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <label htmlFor="inv-discount" className="text-foreground/80 flex-1 font-medium">
                Discount
              </label>
              <ModeToggle currency={currency} value={discountMode} onChange={setDiscountMode} label="Discount" />
              <Input
                id="inv-discount"
                type="number"
                inputMode="decimal"
                min="0"
                max={discountMode === "percent" ? 100 : undefined}
                step="0.01"
                value={discountInput}
                placeholder="0.00"
                onChange={(e) => setDiscountInput(e.target.value)}
                className="h-9 w-28 text-right tabular-nums"
                aria-invalid={discountTooBig || undefined}
              />
            </div>
            {discountMode === "percent" && discount > 0 && (
              <p className="text-muted-foreground text-right text-xs tabular-nums">−{money(discount)}</p>
            )}
            {discountTooBig && <p className="text-destructive text-right text-xs">Discount is larger than the subtotal.</p>}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <label htmlFor="inv-tax" className="text-foreground/80 flex-1 font-medium">
                Tax
              </label>
              <ModeToggle currency={currency} value={taxMode} onChange={setTaxMode} label="Tax" />
              <Input
                id="inv-tax"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={taxInput}
                placeholder="0.00"
                onChange={(e) => setTaxInput(e.target.value)}
                className="h-9 w-28 text-right tabular-nums"
              />
            </div>
            {taxMode === "percent" && tax > 0 && (
              <p className="text-muted-foreground text-right text-xs tabular-nums">+{money(tax)}</p>
            )}
          </div>
          <div className="bg-pale text-navy flex items-center justify-between rounded-2xl px-4 py-3.5">
            <span className="text-base font-semibold">Total</span>
            <span className="font-heading text-2xl font-semibold tabular-nums" aria-live="polite">
              {money(total)}
            </span>
          </div>
        </div>
        <div className="border-border/70 bg-muted/30 flex gap-3 border-t px-5 py-4">
          <Button asChild variant="outline" size="lg" className="flex-1">
            <Link href="/billing/invoices">Cancel</Link>
          </Button>
          <div className="flex flex-1 [&>button]:w-full">
            <SubmitButton label="Create Invoice" icon={<FileText />} />
          </div>
        </div>
      </aside>
    </form>
  );
}
