"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Minus,
  Pill,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Stethoscope,
  UserCog,
  Users,
  Wallet,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PERMISSION_CATALOG, STANDARD_ACTIONS, type StandardAction } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const MODULE_ICON: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  patients: Users,
  appointments: CalendarDays,
  dental_chart: ClipboardList,
  treatments: Stethoscope,
  prescriptions: Pill,
  billing: ReceiptText,
  expenses: Wallet,
  reports: BarChart3,
  staff: UserCog,
  documents: FolderOpen,
  notifications: Bell,
  settings: Settings,
  permissions: ShieldCheck,
};

const COLUMN_LABEL: Record<StandardAction, [string, string]> = {
  view: ["View", "Access"],
  create: ["Create", "Add"],
  edit: ["Edit", "Update"],
  delete: ["Delete", "Remove"],
};

const key = (module: string, action: string) => `${module}.${action}`;

/**
 * Module × action grid. `value` is the set of enabled keys; `baseline` (user mode) marks
 * cells that differ from the role as custom. Turning on any action also turns on View;
 * turning View off turns the whole module off.
 */
export function PermissionMatrix({
  value,
  onChange,
  disabled,
  baseline,
}: {
  value: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
  baseline?: Set<string>;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const modules = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PERMISSION_CATALOG.filter((m) => !q || m.label.toLowerCase().includes(q) || m.actions.some((a) => a.label.toLowerCase().includes(q)));
  }, [query]);
  const visibleKeys = modules.flatMap((m) => m.actions.map((a) => key(m.module, a.action)));

  function toggle(module: string, action: string, on: boolean) {
    const next = new Set(value);
    const k = key(module, action);
    if (on) {
      next.add(k);
      next.add(key(module, "view"));
    } else if (action === "view") {
      for (const a of PERMISSION_CATALOG.find((m) => m.module === module)!.actions) next.delete(key(module, a.action));
    } else next.delete(k);
    onChange(next);
  }

  function setColumn(action: StandardAction, on: boolean) {
    const next = new Set(value);
    for (const m of modules) {
      if (!m.actions.some((a) => a.action === action)) continue;
      if (on) {
        next.add(key(m.module, action));
        next.add(key(m.module, "view"));
      } else if (action === "view") for (const a of m.actions) next.delete(key(m.module, a.action));
      else next.delete(key(m.module, action));
    }
    onChange(next);
  }

  function setAll(on: boolean) {
    const next = new Set(value);
    for (const k of visibleKeys) {
      if (on) next.add(k);
      else next.delete(k);
    }
    onChange(next);
  }

  const columnState = (action: StandardAction) => {
    const keys = modules.filter((m) => m.actions.some((a) => a.action === action)).map((m) => key(m.module, action));
    const on = keys.filter((k) => value.has(k)).length;
    return on === 0 ? false : on === keys.length ? true : ("indeterminate" as const);
  };
  const allExpanded = modules.length > 0 && modules.every((m) => expanded.has(m.module));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:max-w-sm lg:flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search modules…" className="h-10 rounded-xl pl-9" aria-label="Search modules" />
        </div>
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          <Button variant="outline" className="rounded-xl" onClick={() => setAll(true)} disabled={disabled}>
            Select All
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={() => setAll(false)} disabled={disabled}>
            Clear All
          </Button>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => setExpanded(allExpanded ? new Set() : new Set(modules.map((m) => m.module)))}
          >
            {allExpanded ? "Collapse All" : "Expand All"}
          </Button>
        </div>
      </div>

      <div className="border-border/70 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="bg-muted/50 text-left">
              <th className="text-muted-foreground py-3 pr-3 pl-12 text-xs font-semibold tracking-wide uppercase">Module / Feature</th>
              {STANDARD_ACTIONS.map((a) => (
                <th key={a} className="w-24 px-2 py-2.5">
                  <label className="flex items-start gap-2">
                    <Checkbox
                      checked={columnState(a)}
                      onCheckedChange={(c) => setColumn(a, c === true)}
                      disabled={disabled}
                      aria-label={`Toggle ${COLUMN_LABEL[a][0]} for all modules`}
                      className="mt-0.5"
                    />
                    <span className="leading-tight">
                      <span className="text-navy block text-sm font-semibold">{COLUMN_LABEL[a][0]}</span>
                      <span className="text-muted-foreground text-[11px]">({COLUMN_LABEL[a][1]})</span>
                    </span>
                  </label>
                </th>
              ))}
              <th className="text-navy px-3 py-3 text-sm font-semibold">Other Actions</th>
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {modules.map((m) => {
              const Icon = MODULE_ICON[m.module] ?? FileText;
              const extras = m.actions.filter((a) => !(STANDARD_ACTIONS as readonly string[]).includes(a.action));
              const open = expanded.has(m.module);
              return (
                <Fragment key={m.module}>
                  <tr className="hover:bg-pale/30">
                    <td className="py-2.5 pr-3 pl-3">
                      <button
                        type="button"
                        onClick={() => setExpanded((prev) => { const n = new Set(prev); if (n.has(m.module)) n.delete(m.module); else n.add(m.module); return n; })}
                        className="text-navy flex items-center gap-3 rounded-lg text-left font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        aria-expanded={open}
                      >
                        <ChevronRight className={cn("text-muted-foreground size-4 transition-transform", open && "rotate-90")} aria-hidden />
                        <Icon className="text-muted-foreground size-[1.1rem]" aria-hidden />
                        {m.label}
                      </button>
                    </td>
                    {STANDARD_ACTIONS.map((a) => {
                      const def = m.actions.find((x) => x.action === a);
                      const k = key(m.module, a);
                      return (
                        <td key={a} className="px-2 py-2.5">
                          {def ? (
                            <Cell checked={value.has(k)} custom={baseline ? baseline.has(k) !== value.has(k) : false} disabled={disabled} label={`${def.label} ${m.label}`} onChange={(on) => toggle(m.module, a, on)} />
                          ) : (
                            <Minus className="text-muted-foreground/50 size-4" aria-label="Not applicable" />
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5">
                      {extras.length ? (
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                          {extras.map((x) => {
                            const k = key(m.module, x.action);
                            return (
                              <label key={x.action} className="text-foreground/85 flex items-center gap-2 text-sm">
                                <Cell checked={value.has(k)} custom={baseline ? baseline.has(k) !== value.has(k) : false} disabled={disabled} label={`${x.label} (${m.label})`} onChange={(on) => toggle(m.module, x.action, on)} />
                                {x.label}
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <Minus className="text-muted-foreground/50 size-4" aria-hidden />
                      )}
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-muted/20">
                      <td colSpan={6} className="px-12 py-3">
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {m.actions.map((x) => {
                            const k = key(m.module, x.action);
                            return (
                              <li key={x.action} className="flex items-start gap-2.5">
                                <Cell checked={value.has(k)} custom={baseline ? baseline.has(k) !== value.has(k) : false} disabled={disabled} label={`${x.label} ${m.label}`} onChange={(on) => toggle(m.module, x.action, on)} />
                                <span className="leading-snug">
                                  <span className="text-navy font-medium">{x.label}</span>
                                  <span className="text-muted-foreground block text-xs">{x.description}</span>
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {modules.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted-foreground py-10 text-center">
                  No modules match &quot;{query}&quot;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {baseline && (
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <span className="size-2.5 rounded-full bg-amber-400 ring-2 ring-amber-100" aria-hidden /> Differs from the user&apos;s role (custom permission)
        </p>
      )}
    </div>
  );
}

function Cell({ checked, custom, disabled, label, onChange }: { checked: boolean; custom: boolean; disabled?: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <span className="relative inline-flex">
      <Checkbox checked={checked} onCheckedChange={(c) => onChange(c === true)} disabled={disabled} aria-label={label} className="size-5 rounded-md" />
      {custom && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-amber-400 ring-2 ring-white" title="Custom for this user" aria-hidden />}
    </span>
  );
}
