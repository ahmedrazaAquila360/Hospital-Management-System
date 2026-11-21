"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Eye, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteDocumentAction } from "@/server/documents/actions";

/** Preview and download go through the existing session-checked /documents/[id]/file route. */
export function DocumentRowActions({
  id,
  name,
  patientId,
  canManage,
}: {
  id: string;
  name: string;
  patientId: string | null;
  canManage: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <IconLink href={`/documents/${id}/file`} label="Preview" ariaLabel={`Preview ${name}`} newTab>
        <Eye />
      </IconLink>
      <IconLink href={`/documents/${id}/file?download=1`} label="Download" ariaLabel={`Download ${name}`} download>
        <Download />
      </IconLink>
      {canManage && <DeleteDocumentButton id={id} name={name} patientId={patientId} />}
    </div>
  );
}

function IconLink({
  href,
  label,
  ariaLabel,
  newTab,
  download,
  children,
}: {
  href: string;
  label: string;
  ariaLabel: string;
  newTab?: boolean;
  download?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="ghost" size="icon" className="text-muted-foreground hover:text-navy size-9 rounded-xl">
          <a href={href} aria-label={ariaLabel} {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...(download ? { download: true } : {})}>
            {children}
          </a>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Confirmed delete with a toast either way (it used to fail or succeed silently). */
function DeleteDocumentButton({ id, name, patientId }: { id: string; name: string; patientId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    startTransition(async () => {
      try {
        const result = await deleteDocumentAction(id, patientId);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(`Deleted "${name}".`);
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Couldn't delete the document. Please try again.");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="bg-destructive/5 text-destructive hover:bg-destructive/10 hover:text-destructive size-9 rounded-xl" aria-label={`Delete ${name}`}>
              <Trash2 />
            </Button>
          </AlertDialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Delete</TooltipContent>
      </Tooltip>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete document?</AlertDialogTitle>
          <AlertDialogDescription>This will permanently delete &quot;{name}&quot;. This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button className="bg-destructive bg-none hover:bg-destructive/90 text-white" onClick={onDelete} disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />} Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
