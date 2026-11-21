"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { Building2, Clock, LockKeyhole, SlidersHorizontal, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const SETTINGS_TABS = ["profile", "password", "clinic", "hours", "system"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

const META: Record<SettingsTab, { label: string; hint: string; icon: LucideIcon }> = {
  profile: { label: "Profile", hint: "Your name, photo and contact", icon: UserRound },
  password: { label: "Password", hint: "Change your sign-in password", icon: LockKeyhole },
  clinic: { label: "Hospital", hint: "Details shown on documents", icon: Building2 },
  hours: { label: "Working Hours", hint: "Opening times and shifts", icon: Clock },
  system: { label: "System", hint: "Currency, dates and time zone", icon: SlidersHorizontal },
};

/**
 * Settings layout: a section list on the left (a scrollable row on small screens) and the
 * active form on the right. Panels stay mounted while hidden so switching sections never
 * throws away unsaved edits; the active section is mirrored in `?tab=` for deep links.
 */
export function SettingsTabs({
  profile,
  password,
  clinic,
  hours,
  system,
  defaultTab = "profile",
}: {
  profile: ReactNode;
  password: ReactNode;
  clinic?: ReactNode;
  hours?: ReactNode;
  system?: ReactNode;
  /** Raw `?tab=` value; anything unknown or not permitted falls back to Profile. */
  defaultTab?: string;
}) {
  const panels: Partial<Record<SettingsTab, ReactNode>> = { profile, password, clinic, hours, system };
  const available = SETTINGS_TABS.filter((tab) => panels[tab]);
  const [tab, setTab] = useState<SettingsTab>(() => available.find((t) => t === defaultTab) ?? "profile");
  const listRef = useRef<HTMLDivElement>(null);

  // On phones the section list is a horizontal row: keep the active section in view
  // (e.g. when opened via ?tab=system). Scrolls only the row, never the page.
  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[data-state="active"]');
    if (!list || !active || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: active.offsetLeft - 8, behavior: "smooth" });
  }, [tab]);

  function select(value: string) {
    setTab(value as SettingsTab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    window.history.replaceState(null, "", url);
  }

  return (
    <TabsPrimitive.Root
      value={tab}
      onValueChange={select}
      orientation="vertical"
      className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-6 xl:grid-cols-[18.5rem_minmax(0,1fr)]"
    >
      <TabsPrimitive.List
        ref={listRef}
        aria-label="Settings sections"
        className="surface-card no-scrollbar -mx-1 flex gap-1 overflow-x-auto p-1.5 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:overflow-visible lg:p-2"
      >
        {available.map((value) => {
          const { label, hint, icon: Icon } = META[value];
          return (
            <TabsPrimitive.Trigger
              key={value}
              value={value}
              className={cn(
                "group flex shrink-0 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors outline-none lg:w-full lg:py-3",
                "hover:bg-muted/70 focus-visible:ring-ring/60 focus-visible:ring-2",
                "data-[state=active]:bg-pale data-[state=active]:hover:bg-pale"
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                  "bg-muted text-muted-foreground",
                  "group-data-[state=active]:text-brand group-data-[state=active]:bg-white group-data-[state=active]:shadow-sm dark:group-data-[state=active]:bg-white/10"
                )}
                aria-hidden
              >
                <Icon className="size-[1.05rem]" />
              </span>
              <span className="grid min-w-0 leading-tight">
                <span className="text-foreground/75 group-data-[state=active]:text-navy text-sm font-semibold whitespace-nowrap">
                  {label}
                </span>
                <span className="text-muted-foreground mt-0.5 hidden truncate text-xs lg:block">{hint}</span>
              </span>
            </TabsPrimitive.Trigger>
          );
        })}
      </TabsPrimitive.List>

      {available.map((value) => (
        <TabsPrimitive.Content
          key={value}
          value={value}
          forceMount
          className="animate-fade-up min-w-0 outline-none data-[state=inactive]:hidden"
        >
          {panels[value]}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
