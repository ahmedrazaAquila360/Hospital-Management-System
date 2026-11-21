"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { updateAppointmentRequestStatusAction } from "@/server/appointment-requests/actions";

/** Confirm / decline a pending website request (same server action as before, now with feedback). */
export function RequestActions({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function setStatus(status: "CONFIRMED" | "DECLINED") {
    startTransition(async () => {
      try {
        await updateAppointmentRequestStatusAction(id, status);
        toast.success(status === "CONFIRMED" ? `Request from ${name} marked confirmed.` : `Request from ${name} declined.`);
        router.refresh();
      } catch {
        toast.error("Couldn't update the request. Please try again.");
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            disabled={isPending}
            onClick={() => setStatus("CONFIRMED")}
            className="bg-success/10 text-success hover:bg-success hover:text-white size-9 rounded-xl"
            aria-label={`Mark request from ${name} confirmed`}
          >
            {isPending ? <Loader2 className="animate-spin" /> : <Check />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Mark confirmed</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            disabled={isPending}
            onClick={() => setStatus("DECLINED")}
            className="bg-destructive/10 text-destructive hover:bg-destructive size-9 rounded-xl hover:text-white"
            aria-label={`Decline request from ${name}`}
          >
            <X />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Decline</TooltipContent>
      </Tooltip>
    </div>
  );
}
