"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { CalendarDays, Coins, Globe2, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { updateSystemSettingsAction } from "@/server/settings/actions";
import type { getClinicSettings } from "@/server/settings/queries";
import {
  FieldRow,
  IconInput,
  RequiredMark,
  SettingsFooter,
  SettingsPanel,
  SettingsSection,
  useSettingsForm,
} from "@/components/settings/settings-ui";

const CURRENCIES: Record<string, string> = {
  USD: "US Dollar ($)",
  EUR: "Euro (€)",
  GBP: "British Pound (£)",
  CAD: "Canadian Dollar (CA$)",
  AUD: "Australian Dollar (A$)",
  PKR: "Pakistani Rupee (Rs)",
  INR: "Indian Rupee (₹)",
};
const DATE_FORMATS = ["MM/dd/yyyy", "dd/MM/yyyy", "yyyy-MM-dd", "MMM d, yyyy"];
// A fixed sample date keeps the server and browser render identical.
const SAMPLE_DATE = new Date(2026, 2, 24);

/** Keeps a saved value selectable even if it is not one of the built-in options. */
function withCurrent(options: string[], current: string) {
  return options.includes(current) ? options : [current, ...options];
}

function sampleFor(pattern: string) {
  try {
    return format(SAMPLE_DATE, pattern);
  } catch {
    return pattern;
  }
}

const triggerClass = "h-11! w-full pl-10";
const leadingIcon = "text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2";

export function SystemTab({ clinic }: { clinic: Awaited<ReturnType<typeof getClinicSettings>> }) {
  const { pending, dirty, markDirty, formProps } = useSettingsForm(
    updateSystemSettingsAction,
    "System settings updated."
  );
  // Controlled, and submitted through hidden inputs rather than Radix's `name` prop: a
  // native form reset rewinds Radix's hidden <select> without updating the trigger, so
  // after a save the next submit could silently send the old value.
  const [currency, setCurrency] = useState(clinic.currency);
  const [dateFormat, setDateFormat] = useState(clinic.dateFormat);
  const [timeZones, setTimeZones] = useState<string[]>([]);
  const timeZoneRef = useRef<HTMLInputElement>(null);

  // Suggestions load on first focus: keeps ~400 options out of the initial render and
  // avoids a server/browser mismatch (their zone lists differ).
  function loadTimeZones() {
    if (timeZones.length) return;
    try {
      setTimeZones(Intl.supportedValuesOf("timeZone"));
    } catch {
      // Older browsers: free-text entry still works.
    }
  }

  function applyBrowserTimeZone() {
    const input = timeZoneRef.current;
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!input || !zone || input.value === zone) return;
    input.value = zone;
    markDirty();
  }

  return (
    <SettingsPanel title="System" description="The clinic's currency, date format and time zone.">
      <form
        {...formProps}
        onReset={() => {
          formProps.onReset();
          setCurrency(clinic.currency);
          setDateFormat(clinic.dateFormat);
        }}
      >
        <SettingsSection title="Regional formats">
          <FieldRow>
            <Field>
              <FieldLabel htmlFor="currency">
                Currency <RequiredMark />
              </FieldLabel>
              <input type="hidden" name="currency" value={currency} />
              <div className="relative">
                <Coins className={leadingIcon} aria-hidden />
                <Select
                  value={currency}
                  onValueChange={(v) => {
                    setCurrency(v);
                    markDirty();
                  }}
                >
                  <SelectTrigger id="currency" className={triggerClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {withCurrent(Object.keys(CURRENCIES), clinic.currency).map((code) => (
                      <SelectItem key={code} value={code}>
                        <span className="font-medium">{code}</span>
                        {CURRENCIES[code] && <span className="text-muted-foreground">· {CURRENCIES[code]}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FieldDescription className="text-xs">The clinic&apos;s billing currency.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="dateFormat">
                Date Format <RequiredMark />
              </FieldLabel>
              <input type="hidden" name="dateFormat" value={dateFormat} />
              <div className="relative">
                <CalendarDays className={leadingIcon} aria-hidden />
                <Select
                  value={dateFormat}
                  onValueChange={(v) => {
                    setDateFormat(v);
                    markDirty();
                  }}
                >
                  <SelectTrigger id="dateFormat" className={triggerClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {withCurrent(DATE_FORMATS, clinic.dateFormat).map((f) => (
                      <SelectItem key={f} value={f}>
                        <span className="font-medium">{f}</span>
                        <span className="text-muted-foreground">· {sampleFor(f)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FieldDescription className="text-xs">
                Example: <span className="text-foreground font-medium">{sampleFor(dateFormat)}</span>
              </FieldDescription>
            </Field>
          </FieldRow>
        </SettingsSection>

        <SettingsSection title="Time zone" description="The clinic's local time zone (IANA name, e.g. Asia/Karachi).">
          <FieldGroup className="gap-3">
            <FieldRow>
              <Field>
                <FieldLabel htmlFor="timeZone">
                  Time Zone <RequiredMark />
                </FieldLabel>
                <IconInput
                  ref={timeZoneRef}
                  icon={<Globe2 />}
                  id="timeZone"
                  name="timeZone"
                  list="settings-time-zones"
                  defaultValue={clinic.timeZone}
                  placeholder="e.g. America/New_York"
                  autoComplete="off"
                  required
                  onFocus={loadTimeZones}
                />
                <datalist id="settings-time-zones">
                  {timeZones.map((zone) => (
                    <option key={zone} value={zone} />
                  ))}
                </datalist>
              </Field>
            </FieldRow>
            <div>
              <Button type="button" variant="ghost" size="sm" className="text-brand -ml-2" onClick={applyBrowserTimeZone}>
                <LocateFixed /> Use my current time zone
              </Button>
            </div>
          </FieldGroup>
        </SettingsSection>

        <SettingsFooter pending={pending} dirty={dirty} />
      </form>
    </SettingsPanel>
  );
}
