"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, CalendarDays, DollarSign, Loader2, Plus, Save, Tag, Type, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldLabel } from "@/components/ui/field";
import { IconInput } from "@/components/shared/icon-input";
import { RequiredMark, localToday } from "@/components/shared/record-form";
import { createExpenseAction } from "@/server/expenses/actions";
import { EXPENSE_CATEGORIES } from "@/lib/validations/expense";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/labels";

/**
 * Add Expense modal: Title, Category, Amount, Date, Description (the fields the action takes).
 * The action is called directly in a transition, so a server error keeps the dialog open with
 * everything typed, and success closes it, toasts and refreshes the list.
 */
export function AddExpenseDialog({currency}:{currency:string}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("OTHER");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Remount the form each time the dialog opens so it starts clean, with today's local date.
  const [formKey, setFormKey] = useState(0);

  function onOpenChange(next: boolean) {
    if (isPending) return;
    setOpen(next);
    if (next) {
      setFormKey((k) => k + 1);
      setCategory("OTHER");
      setError(null);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        const result = await createExpenseAction({}, formData);
        if (result.success) {
          toast.success("Expense recorded.");
          setOpen(false);
          router.refresh();
        } else {
          setError(result.error ?? "Couldn't save the expense.");
        }
      } catch {
        setError("Couldn't save the expense. Please try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg" className="rounded-full px-5">
          <Plus /> Add Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <DialogHeader className="border-border/70 flex-row items-center gap-3 border-b px-6 py-5 text-left">
          <span className="bg-pale text-brand flex size-11 shrink-0 items-center justify-center rounded-2xl" aria-hidden>
            <Wallet className="size-5" />
          </span>
          <div>
            <DialogTitle className="text-navy text-xl">Add Expense</DialogTitle>
            <DialogDescription>Record a new clinic expense.</DialogDescription>
          </div>
        </DialogHeader>

        <form key={formKey} onSubmit={onSubmit} className="flex flex-col">
          <div className="grid gap-5 px-6 py-5 sm:grid-cols-2">
            {error && (
              <p role="alert" className="border-destructive/25 bg-destructive/5 text-destructive flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm sm:col-span-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
              </p>
            )}
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="exp-title">
                Title <RequiredMark />
              </FieldLabel>
              <IconInput icon={<Type />} id="exp-title" name="title" placeholder="e.g. Monthly clinic rent" minLength={2} autoComplete="off" required autoFocus />
            </Field>
            <Field>
              <FieldLabel htmlFor="exp-date">
                Expense Date <RequiredMark />
              </FieldLabel>
              {/* Local date (toISOString gave yesterday's date in zones ahead of UTC). */}
              <IconInput icon={<CalendarDays />} id="exp-date" name="date" type="date" defaultValue={localToday()} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="exp-category">
                Category <RequiredMark />
              </FieldLabel>
              <input type="hidden" name="category" value={category} />
              <div className="relative">
                <Tag className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2" aria-hidden />
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="exp-category" className="h-11! w-full pl-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {EXPENSE_CATEGORY_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="exp-amount">
                Amount ({currency}) <RequiredMark />
              </FieldLabel>
              <IconInput
                icon={<DollarSign />}
                id="exp-amount"
                name="amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                className="tabular-nums"
                required
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="exp-description">Description</FieldLabel>
              <Textarea id="exp-description" name="description" rows={3} placeholder="Optional details, e.g. vendor or what was purchased" />
            </Field>
          </div>

          <div className="border-border/70 bg-muted/30 flex gap-3 border-t px-6 py-4 sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="lg" className="flex-1 sm:flex-none" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" className="flex-1 sm:flex-none" disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : <Save />}
              {isPending ? "Saving…" : "Save Expense"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
