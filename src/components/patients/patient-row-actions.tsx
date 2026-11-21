"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, ClipboardList, Eye, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ACTION_MENU_CONTENT, ACTION_MENU_ITEM, ActionMenuItemBody, ActionMenuTrigger } from "@/components/shared/action-menu";
import { DeletePatientDialog } from "@/components/patients/delete-patient-dialog";

/** Patient ⋯ menu: view, edit, book, treatment history and (admins) delete. */
export function PatientRowActions({
  patientId,
  patientCode,
  patientName,
  canManage,
  canDelete,
}: {
  patientId: string;
  patientCode: string;
  patientName: string;
  canManage: boolean;
  canDelete: boolean;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ActionMenuTrigger label={`Actions for ${patientName}`} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={ACTION_MENU_CONTENT}>
          <DropdownMenuItem asChild className={ACTION_MENU_ITEM}>
            <Link href={`/patients/${patientId}`}>
              <ActionMenuItemBody icon={Eye} title="View Patient Profile" />
            </Link>
          </DropdownMenuItem>
          {canManage && (
            <DropdownMenuItem asChild className={ACTION_MENU_ITEM}>
              <Link href={`/patients/${patientId}/edit`}>
                <ActionMenuItemBody icon={Pencil} title="Edit Patient" />
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild className={ACTION_MENU_ITEM}>
            <Link href={`/appointments/new?patientId=${patientId}`}>
              <ActionMenuItemBody icon={CalendarDays} title="Book Appointment" />
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className={ACTION_MENU_ITEM}>
            <Link href={`/patients/${patientId}?tab=treatments`}>
              <ActionMenuItemBody icon={ClipboardList} title="View Treatment History" />
            </Link>
          </DropdownMenuItem>
          {canDelete && (
            <>
              <DropdownMenuSeparator className="mx-1" />
              <DropdownMenuItem
                variant="destructive"
                className={ACTION_MENU_ITEM}
                onSelect={(e) => {
                  e.preventDefault();
                  setDeleteOpen(true);
                }}
              >
                <ActionMenuItemBody icon={Trash2} title="Archive patient" tone="destructive" />
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {canDelete && (
        <DeletePatientDialog
          patientId={patientId}
          patientCode={patientCode}
          patientName={patientName}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      )}
    </>
  );
}
