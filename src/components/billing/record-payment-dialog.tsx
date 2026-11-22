"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Check, CreditCard, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldLabel } from "@/components/ui/field";
import { RequiredMark } from "@/components/shared/record-form";
import { recordPaymentAction } from "@/server/billing/actions";
import { PAYMENT_METHODS } from "@/lib/validations/invoice";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Record Payment modal: invoice summary, amount (full or partial), method and an optional
 * reference / note. The server re-checks the balance and sets the invoice to Paid or
 * Partially Paid; errors stay in the dialog with the amount kept.
 */
export function RecordPaymentDialog({
  invoiceId,
  invoiceNumber,
  total,
  remaining,
  triggerClassName,
}: {
  invoiceId: string;
  invoiceNumber: string;
  total: number;
  remaining: number;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const balance = round2(remaining);
  const [open, setOpen] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [amount, setAmount] = useState(balance.toFixed(2));
  const [method, setMethod] = useState("CASH");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (balance <= 0) return null;

  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0 && round2(value) <= balance;
  const after = valid ? round2(balance - value) : null;

  function onOpenChange(next: boolean) {
    if (isPending) return;
    setOpen(next);
    if (next) {
      setRequestId(crypto.randomUUID());
      setFormKey((k) => k + 1);
      setAmount(balance.toFixed(2));
      setMethod("CASH");
      setError(null);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    if (!(Number.isFinite(value) && value > 0)) return setError("Enter an amount greater than $0.00.");
    if (round2(value) > balance) return setError(`The amount can't be more than the remaining balance of ${money(balance)}.`);
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const result = await recordPaymentAction({}, formData);
        if (result.success) {
          toast.success(after === 0 ? `Payment recorded — ${invoiceNumber} is fully paid.` : `Payment of ${money(value)} recorded.`);
          setOpen(false);
          router.refresh();
        } else {
          setError(result.error ?? "Couldn't record the payment.");
        }
      } catch {
        setError("Couldn't record the payment. Please try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg" className={cn("rounded-xl", triggerClassName)}>
          <CreditCard /> Record Payment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <DialogHeader className="flex-row items-center gap-3 px-6 pt-6 pb-4 text-left">
          <span className="bg-pale text-brand flex size-12 shrink-0 items-center justify-center rounded-2xl" aria-hidden>
            <CreditCard className="size-5" />
          </span>
          <div>
            <DialogTitle className="text-navy text-xl">Record Payment</DialogTitle>
            <DialogDescription>Add a payment for this invoice.</DialogDescription>
          </div>
        </DialogHeader>

        <form key={formKey} onSubmit={onSubmit} className="flex flex-col">
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="method" value={method} />
          <div className="grid gap-5 px-6 pb-5">
            <dl className="bg-pale/70 grid grid-cols-3 gap-3 rounded-2xl px-4 py-4">
              <div className="min-w-0">
                <dt className="text-muted-foreground text-xs">Invoice #</dt>
                <dd className="text-navy mt-1 truncate font-semibold">{invoiceNumber}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Total Amount</dt>
                <dd className="text-navy mt-1 font-semibold tabular-nums">{money(total)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Remaining</dt>
                <dd className="text-destructive mt-1 font-semibold tabular-nums">{money(balance)}</dd>
              </div>
            </dl>

            {error && (
              <p role="alert" className="border-destructive/25 bg-destructive/5 text-destructive flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
              </p>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="pay-amount">
                  Payment Amount <RequiredMark />
                </FieldLabel>
                <div className="relative">
                  <span className="text-muted-foreground border-border/80 pointer-events-none absolute inset-y-2 left-0 flex w-10 items-center justify-center border-r text-sm font-medium" aria-hidden>
                    $
                  </span>
                  <input
                    id="pay-amount"
                    name="amount"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    max={balance}
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setError(null);
                    }}
                    required
                    autoFocus
                    className="border-input bg-card focus-visible:border-brand focus-visible:ring-cyan/15 h-11 w-full rounded-lg border pr-3 pl-12 text-sm tabular-nums shadow-xs outline-none focus-visible:ring-4"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAmount(balance.toFixed(2))}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                      Number(amount) === balance ? "bg-brand text-white" : "bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Full balance
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmount(round2(balance / 2).toFixed(2))}
                    className="bg-muted text-muted-foreground hover:text-foreground rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                  >
                    Half
                  </button>
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="pay-method">
                  Payment Method <RequiredMark />
                </FieldLabel>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger id="pay-method" className="h-11! w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {PAYMENT_METHOD_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="pay-reference">Reference / Notes (optional)</FieldLabel>
              <Textarea
                id="pay-reference"
                name="reference"
                rows={3}
                maxLength={200}
                placeholder="Add reference (e.g. transaction ID, cheque number)"
              />
            </Field>

            {after !== null && (
              <p
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm",
                  after === 0 ? "bg-success/10 text-success" : "bg-amber-50 text-amber-800"
                )}
                aria-live="polite"
              >
                <Wallet className="size-4 shrink-0" aria-hidden />
                {after === 0 ? (
                  <span>
                    Full payment — the invoice will be marked <strong>Paid</strong>.
                  </span>
                ) : (
                  <span>
                    Partial payment — <strong className="tabular-nums">{money(after)}</strong> will remain and the invoice will be marked{" "}
                    <strong>Partially Paid</strong>.
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="border-border/70 flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="lg" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" disabled={isPending} className="min-w-44">
              {isPending ? <Loader2 className="animate-spin" /> : <Check />} {isPending ? "Recording…" : "Record Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
