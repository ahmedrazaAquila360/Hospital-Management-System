"use client";

import { useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { toggleStaffStatusAction } from "@/server/staff/actions";

export function StaffStatusToggle({ id, active, disabled }: { id: string; active: boolean; disabled?: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Switch
      checked={active}
      disabled={disabled || isPending}
      onCheckedChange={() => startTransition(() => toggleStaffStatusAction(id))}
    />
  );
}
