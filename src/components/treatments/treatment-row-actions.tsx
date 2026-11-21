"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleCheck, Eye, Loader2, Pencil, PlayCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ACTION_MENU_CONTENT, ACTION_MENU_ITEM, ActionMenuItemBody, ActionMenuTrigger } from "@/components/shared/action-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteTreatmentAction, updateTreatmentStatusAction } from "@/server/treatments/actions";
import type { TreatmentStatus } from "@/generated/prisma/enums";

/** ⋯ menu per treatment: view, edit, quick status changes and delete (manage only). */
export function TreatmentRowActions({
  id,
  name,
  patientName,
  status,
  canEdit,
  canDelete,
}: {
  id: string;
  name: string;
  patientName: string;
  status: TreatmentStatus;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function setStatus(next: TreatmentStatus, label: string) {
    startTransition(async () => {
      try {
        await updateTreatmentStatusAction(id, next);
        toast.success(`"${name}" marked ${label}.`);
        router.refresh();
      } catch {
        toast.error("Couldn't update the treatment status.");
      }
    });
  }

  function onDelete() {
    startTransition(async () => {
      try {
        const result = await deleteTreatmentAction(id);
        if (result.error) return void toast.error(result.error);
        toast.success(`Deleted "${name}".`);
        setConfirmOpen(false);
        router.refresh();
      } catch {
        toast.error("Couldn't delete the treatment.");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ActionMenuTrigger
            label={`Actions for ${name} (${patientName})`}
            disabled={isPending}
            busy={isPending ? <Loader2 className="size-4 animate-spin" /> : undefined}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={ACTION_MENU_CONTENT}>
          <DropdownMenuItem asChild className={ACTION_MENU_ITEM}>
            <Link href={`/treatments/${id}`}>
              <ActionMenuItemBody icon={Eye} title="View Treatment" />
            </Link>
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem asChild className={ACTION_MENU_ITEM}>
              <Link href={`/treatments/${id}/edit`}>
                <ActionMenuItemBody icon={Pencil} title="Edit Treatment" />
              </Link>
            </DropdownMenuItem>
          )}
          {canEdit && status === "PLANNED" && (
            <DropdownMenuItem className={ACTION_MENU_ITEM} onSelect={() => setStatus("IN_PROGRESS", "in progress")}>
              <ActionMenuItemBody icon={PlayCircle} title="Start Treatment" />
            </DropdownMenuItem>
          )}
          {canEdit && (status === "PLANNED" || status === "IN_PROGRESS") && (
            <DropdownMenuItem className={ACTION_MENU_ITEM} onSelect={() => setStatus("COMPLETED", "completed")}>
              <ActionMenuItemBody icon={CircleCheck} title="Mark as Completed" tone="success" />
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator className="mx-1" />
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
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canDelete && (
        <AlertDialog open={confirmOpen} onOpenChange={(o) => !isPending && setConfirmOpen(o)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete treatment?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes &quot;{name}&quot; and its tooth links. Invoices that billed it keep their line items. This can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <Button className="bg-destructive bg-none hover:bg-destructive/90 text-white" onClick={onDelete} disabled={isPending}>
                {isPending && <Loader2 className="animate-spin" />} Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
