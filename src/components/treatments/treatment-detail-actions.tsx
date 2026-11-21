"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, CircleSlash, FileText, Loader2, PlayCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ACTION_MENU_CONTENT, ACTION_MENU_ITEM, ActionMenuItemBody } from "@/components/shared/action-menu";
import { deleteTreatmentAction, updateTreatmentStatusAction } from "@/server/treatments/actions";
import { TREATMENT_STATUSES } from "@/lib/validations/treatment";
import { TREATMENT_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { TreatmentStatus } from "@/generated/prisma/enums";

const DOT: Record<string, string> = {
  PLANNED: "bg-blue-500",
  IN_PROGRESS: "bg-amber-500",
  COMPLETED: "bg-emerald-500",
  CANCELLED: "bg-slate-400",
};

function useStatusChange(id: string) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  function change(next: TreatmentStatus) {
    startTransition(async () => {
      try {
        await updateTreatmentStatusAction(id, next);
        toast.success(
          next === "COMPLETED" ? "Treatment marked as completed. Admins have been notified." : `Status changed to ${TREATMENT_STATUS_LABEL[next]}.`
        );
        router.refresh();
      } catch {
        toast.error("Couldn't update the treatment status.");
      }
    });
  }
  return { change, isPending };
}

/** Status dropdown in the Treatment Status card. */
export function TreatmentStatusSelect({ id, status, disabled }: { id: string; status: TreatmentStatus; disabled?: boolean }) {
  const { change, isPending } = useStatusChange(id);
  return (
    <Select value={status} onValueChange={(v) => v !== status && change(v as TreatmentStatus)} disabled={disabled || isPending}>
      <SelectTrigger className="h-11! w-full sm:w-56" aria-label="Treatment status">
        {isPending && <Loader2 className="text-brand animate-spin" />}
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {TREATMENT_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            <span className={cn("size-2 rounded-full", DOT[s])} aria-hidden />
            {TREATMENT_STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Bottom action bar: Create / View Invoice and Mark as Completed. */
export function TreatmentActionBar({
  id,
  status,
  patientId,
  invoiceId,
  canManage,
  canBill,
}: {
  id: string;
  status: TreatmentStatus;
  patientId: string;
  invoiceId: string | null;
  canManage: boolean;
  canBill: boolean;
}) {
  const { change, isPending } = useStatusChange(id);
  const open = status === "PLANNED" || status === "IN_PROGRESS";
  if (!canBill && !(canManage && open)) return null;

  return (
    <div className="surface-card flex flex-col-reverse gap-2 p-4 sm:flex-row sm:items-center sm:justify-end sm:p-5">
      {canBill &&
        (invoiceId ? (
          <Button asChild variant="outline" size="lg" className="rounded-xl">
            <Link href={`/billing/invoices/${invoiceId}`}>
              <FileText /> View Invoice
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline" size="lg" className="rounded-xl">
            <Link href={`/billing/invoices/new?patientId=${patientId}&treatmentId=${id}`}>
              <FileText /> Create Invoice
            </Link>
          </Button>
        ))}
      {canManage && open && (
        <Button size="lg" className="rounded-xl" onClick={() => change("COMPLETED")} disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : <Check />} Mark as Completed
        </Button>
      )}
    </div>
  );
}

/** Header ⋯ menu: start, cancel and delete. */
export function TreatmentHeaderMenu({
  id,
  name,
  status,
  canEdit,
  canDelete,
}: {
  id: string;
  name: string;
  status: TreatmentStatus;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { change, isPending } = useStatusChange(id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  function onDelete() {
    startDelete(async () => {
      try {
        const result = await deleteTreatmentAction(id);
        if (result.error) return void toast.error(result.error);
        toast.success(`Deleted "${name}".`);
        router.push("/treatments");
      } catch {
        toast.error("Couldn't delete the treatment.");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="size-10 rounded-xl" aria-label="More treatment actions" disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : <span className="text-lg leading-none">⋮</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={ACTION_MENU_CONTENT}>
          {canEdit && status === "PLANNED" && (
            <DropdownMenuItem className={ACTION_MENU_ITEM} onSelect={() => change("IN_PROGRESS")}>
              <ActionMenuItemBody icon={PlayCircle} title="Start Treatment" />
            </DropdownMenuItem>
          )}
          {canEdit && (status === "PLANNED" || status === "IN_PROGRESS") && (
            <DropdownMenuItem className={ACTION_MENU_ITEM} onSelect={() => change("CANCELLED")}>
              <ActionMenuItemBody icon={CircleSlash} title="Cancel Treatment" />
            </DropdownMenuItem>
          )}
          {canEdit && canDelete && (status === "PLANNED" || status === "IN_PROGRESS") && <DropdownMenuSeparator className="mx-1" />}
          {canDelete && (
          <DropdownMenuItem
            variant="destructive"
            className={ACTION_MENU_ITEM}
            onSelect={(e) => {
              e.preventDefault();
              setConfirmOpen(true);
            }}
          >
            <ActionMenuItemBody icon={Trash2} title="Delete Treatment" tone="destructive" />
          </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmOpen} onOpenChange={(o) => !isDeleting && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete treatment?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes &quot;{name}&quot; and its tooth links. Invoices that billed it keep their line items. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button className="bg-destructive bg-none hover:bg-destructive/90 text-white" onClick={onDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="animate-spin" />} Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
