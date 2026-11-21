"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarCheck,
  CircleCheck,
  CircleSlash,
  Loader2,
  LogIn,
  MoreHorizontal,
  Pencil,
  PlayCircle,
  UserX,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ACTION_MENU_CONTENT, ACTION_MENU_ITEM, ActionMenuItemBody } from "@/components/shared/action-menu";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { canCancel, canMarkNoShow, canReschedule, NEXT_STATUSES } from "@/lib/appointment-status";
import { updateAppointmentStatusAction } from "@/server/appointments/actions";
import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/generated/prisma/enums";

const STEP: Partial<Record<AppointmentStatus, { label: string; done: string; icon: LucideIcon; tone?: "success" }>> = {
  CONFIRMED: { label: "Confirm Appointment", done: "Appointment confirmed.", icon: CalendarCheck },
  CHECKED_IN: { label: "Check In Patient", done: "Patient checked in.", icon: LogIn },
  IN_PROGRESS: { label: "Start Visit", done: "Visit started.", icon: PlayCircle },
  COMPLETED: { label: "Mark as Completed", done: "Appointment completed.", icon: CircleCheck, tone: "success" },
};

/**
 * ⋯ status menu for an appointment: the next steps of the visit flow, plus No-show and Cancel
 * behind a confirmation. Used in the day calendar (compact) and on Appointment Details (header,
 * where Reschedule has its own button). Renders nothing when no action is left.
 */
export function AppointmentQuickActions({
  id,
  status,
  patientName,
  variant = "compact",
}: {
  id: string;
  status: AppointmentStatus;
  patientName?: string;
  variant?: "compact" | "header";
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();

  const next = NEXT_STATUSES[status].filter((s) => STEP[s]);
  const showEdit = variant === "compact" && canReschedule(status);
  const cancellable = canCancel(status);
  const noShow = canMarkNoShow(status);
  if (next.length === 0 && !showEdit && !cancellable && !noShow) return null;

  const who = patientName ? `${patientName}'s` : "this";

  function setStatus(to: AppointmentStatus, done: string) {
    startTransition(async () => {
      try {
        const result = await updateAppointmentStatusAction(id, to);
        if (!result.ok) {
          toast.error(result.error);
        } else {
          toast.success(done);
        }
        router.refresh();
      } catch {
        toast.error("Couldn't update the appointment. Please try again.");
      }
    });
  }

  async function confirmNoShow() {
    const ok = await confirm({
      title: "Mark as no-show?",
      description: `${patientName ?? "The patient"} didn't attend. The visit stays on record as a no-show; you can still reschedule it afterwards.`,
      confirmLabel: "Mark No-show",
      cancelLabel: "Go Back",
      tone: "warning",
      icon: UserX,
    });
    if (ok) setStatus("NO_SHOW", "Marked as no-show.");
  }

  async function confirmCancel() {
    const ok = await confirm({
      title: "Cancel this appointment?",
      description: `This cancels ${who} appointment and lets the dentist know. A cancelled appointment can't be rescheduled — book a new one instead.`,
      confirmLabel: "Cancel Appointment",
      cancelLabel: "Keep Appointment",
      tone: "destructive",
      icon: CircleSlash,
    });
    if (ok) setStatus("CANCELLED", "Appointment cancelled.");
  }

  const header = variant === "header";

  return (
    <>
      {dialog}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Appointment actions"
            disabled={isPending}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "text-navy inline-flex items-center justify-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-60",
              header
                ? "border-border/80 hover:bg-pale data-[state=open]:bg-pale data-[state=open]:text-brand size-11 rounded-full border bg-white shadow-xs"
                : "hover:bg-pale data-[state=open]:bg-pale data-[state=open]:text-brand size-7 rounded-lg bg-white/80"
            )}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className={header ? "size-5" : "size-4"} />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={ACTION_MENU_CONTENT}>
          <DropdownMenuLabel className="text-muted-foreground px-3 pt-1.5 pb-1 text-xs font-semibold tracking-wide uppercase">
            Actions
          </DropdownMenuLabel>
          {next.map((s) => {
            const step = STEP[s]!;
            return (
              <DropdownMenuItem key={s} className={ACTION_MENU_ITEM} onSelect={() => setStatus(s, step.done)}>
                <ActionMenuItemBody icon={step.icon} title={step.label} tone={step.tone} />
              </DropdownMenuItem>
            );
          })}
          {showEdit && (
            <DropdownMenuItem asChild className={ACTION_MENU_ITEM}>
              <Link href={`/appointments/${id}/edit`}>
                <ActionMenuItemBody icon={Pencil} title="Edit Appointment" />
              </Link>
            </DropdownMenuItem>
          )}
          {(noShow || cancellable) && (next.length > 0 || showEdit) && <DropdownMenuSeparator className="mx-1" />}
          {noShow && (
            <DropdownMenuItem className={ACTION_MENU_ITEM} onSelect={confirmNoShow}>
              <ActionMenuItemBody icon={UserX} title="Mark as No-show" />
            </DropdownMenuItem>
          )}
          {cancellable && (
            <DropdownMenuItem variant="destructive" className={ACTION_MENU_ITEM} onSelect={confirmCancel}>
              <ActionMenuItemBody icon={CircleSlash} title="Cancel Appointment" tone="destructive" />
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
