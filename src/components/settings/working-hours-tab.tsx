"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Copy, Moon, Plus, Sun, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { SettingsFooter, SettingsPanel, SettingsSection } from "@/components/settings/settings-ui";
import { updateWorkingHoursAction } from "@/server/settings/actions";
import {
  DEFAULT_WORKING_HOURS,
  MAX_SHIFTS,
  WEEK_DAYS,
  formatShifts,
  validateWorkingHours,
  type DayKey,
  type Shift,
  type WorkingHours,
} from "@/lib/working-hours";
import { cn } from "@/lib/utils";

const NEXT_SHIFT: Shift = { open: "16:00", close: "22:00" };

/**
 * Weekly opening hours. Each day is open or closed and can have up to three shifts, e.g.
 * 8:00 AM – 12:00 PM and 4:00 PM – 10:00 PM for a clinic that closes in the afternoon.
 * New and rescheduled appointments must fit inside one of these shifts.
 */
export function WorkingHoursTab({ initial }: { initial: WorkingHours | null }) {
  const router = useRouter();
  const saved = initial ?? DEFAULT_WORKING_HOURS;
  const [hours, setHours] = useState<WorkingHours>(saved);
  const [baseline, setBaseline] = useState<WorkingHours>(saved);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dirty = JSON.stringify(hours) !== JSON.stringify(baseline);

  function updateDay(key: DayKey, fn: (day: WorkingHours[DayKey]) => WorkingHours[DayKey]) {
    setHours((prev) => ({ ...prev, [key]: fn(prev[key]) }));
    setError(null);
  }

  function copyToAll(from: DayKey) {
    const source = hours[from];
    setHours((prev) => {
      const next = { ...prev };
      for (const { key } of WEEK_DAYS) next[key] = { closed: source.closed, shifts: source.shifts.map((s) => ({ ...s })) };
      return next;
    });
    toast.info(`Copied ${WEEK_DAYS.find((d) => d.key === from)!.label}'s hours to every day. Save to apply.`);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validateWorkingHours(hours);
    if (problem) {
      setError(problem);
      return;
    }
    startTransition(async () => {
      try {
        const result = await updateWorkingHoursAction(hours);
        if (result.error) {
          setError(result.error);
          return;
        }
        setBaseline(hours);
        toast.success("Working hours updated.");
        router.refresh();
      } catch {
        setError("Couldn't save the working hours. Please try again.");
      }
    });
  }

  return (
    <SettingsPanel title="Working Hours" description="When the clinic is open. Appointments can only be booked inside these hours.">
      <form
        onSubmit={onSubmit}
        onReset={(e) => {
          e.preventDefault();
          setHours(baseline);
          setError(null);
        }}
      >
        <SettingsSection
          title="Weekly schedule"
          description="Add a second shift for days the clinic closes in the middle, e.g. 8 AM – 12 PM and 4 PM – 10 PM."
        >
          {error && (
            <p role="alert" className="border-destructive/25 bg-destructive/5 text-destructive mb-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
            </p>
          )}
          <ul className="divide-border/60 border-border/70 divide-y rounded-2xl border">
            {WEEK_DAYS.map(({ key, label }) => {
              const day = hours[key];
              const open = !day.closed;
              return (
                <li key={key} className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-5", !open && "bg-muted/30")}>
                  <div className="flex items-center justify-between gap-3 sm:w-44 sm:shrink-0 sm:pt-2">
                    <div className="flex items-center gap-3">
                      <Switch
                        id={`open-${key}`}
                        checked={open}
                        onCheckedChange={(checked) =>
                          updateDay(key, (d) => ({
                            closed: !checked,
                            shifts: checked && d.shifts.length === 0 ? [{ open: "09:00", close: "17:00" }] : d.shifts,
                          }))
                        }
                        aria-label={`${label} open`}
                      />
                      <label htmlFor={`open-${key}`} className="text-navy cursor-pointer text-sm font-semibold">
                        {label}
                      </label>
                    </div>
                    <span className={cn("text-xs font-medium sm:hidden", open ? "text-success" : "text-muted-foreground")}>{open ? "Open" : "Closed"}</span>
                  </div>

                  {open ? (
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      {day.shifts.map((shift, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground flex w-20 items-center gap-1.5 text-xs font-medium">
                            {shift.open < "12:00" ? <Sun className="size-3.5" aria-hidden /> : <Moon className="size-3.5" aria-hidden />}
                            Shift {i + 1}
                          </span>
                          <Input
                            type="time"
                            value={shift.open}
                            onChange={(e) => updateDay(key, (d) => ({ ...d, shifts: d.shifts.map((s, j) => (j === i ? { ...s, open: e.target.value } : s)) }))}
                            className="h-10 w-32"
                            aria-label={`${label} shift ${i + 1} opening time`}
                            required
                          />
                          <span className="text-muted-foreground text-sm">to</span>
                          <Input
                            type="time"
                            value={shift.close}
                            onChange={(e) => updateDay(key, (d) => ({ ...d, shifts: d.shifts.map((s, j) => (j === i ? { ...s, close: e.target.value } : s)) }))}
                            className="h-10 w-32"
                            aria-label={`${label} shift ${i + 1} closing time`}
                            required
                          />
                          {day.shifts.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => updateDay(key, (d) => ({ ...d, shifts: d.shifts.filter((_, j) => j !== i) }))}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive size-9 rounded-xl"
                              aria-label={`Remove ${label} shift ${i + 1}`}
                            >
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                      ))}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {day.shifts.length < MAX_SHIFTS && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg"
                            onClick={() =>
                              updateDay(key, (d) => {
                                const last = d.shifts[d.shifts.length - 1];
                                const next = last && last.close >= NEXT_SHIFT.open ? { open: last.close, close: "23:00" } : NEXT_SHIFT;
                                return { ...d, shifts: [...d.shifts, next] };
                              })
                            }
                          >
                            <Plus /> Add shift
                          </Button>
                        )}
                        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground rounded-lg" onClick={() => copyToAll(key)}>
                          <Copy /> Copy to all days
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm sm:pt-2">Closed — no appointments can be booked.</p>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="bg-pale/50 mt-4 rounded-xl px-4 py-3 text-xs leading-relaxed">
            <p className="text-navy mb-1 font-semibold">Summary</p>
            <ul className="text-foreground/75 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
              {WEEK_DAYS.map(({ key, label }) => (
                <li key={key} className="flex justify-between gap-3">
                  <span>{label}</span>
                  <span className="text-right font-medium">{formatShifts(hours[key])}</span>
                </li>
              ))}
            </ul>
          </div>
        </SettingsSection>

        <SettingsFooter pending={isPending} dirty={dirty} />
      </form>
    </SettingsPanel>
  );
}
