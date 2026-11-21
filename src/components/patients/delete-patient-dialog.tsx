"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deletePatientAction } from "@/server/patients/actions";

export function DeletePatientDialog({
  patientId,
  patientCode,
  patientName,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  patientId: string;
  patientCode: string;
  patientName: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();
  const canConfirm = confirmText.trim() === patientCode;

  function handleDelete() {
    startTransition(() => {
      return deletePatientAction(patientId);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive {patientName}?</DialogTitle>
          <DialogDescription>
            Archiving removes this patient from active registration lists and preserves their history.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Type <span className="font-mono">{patientCode}</span> to confirm
          </label>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!canConfirm || isPending}
            onClick={handleDelete}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 />}
            Archive patient
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
