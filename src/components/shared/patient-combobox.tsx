"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { Patient } from "@/generated/prisma/client";

export type PatientOption = Pick<Patient,"id"|"fullName"|"phone"|"patientCode">;

export function PatientCombobox({
  name,
  defaultPatient,
  onSelect,
}: {
  name: string;
  defaultPatient?: PatientOption | null;
  onSelect?: (patient: PatientOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [choice, setChoice] = useState<{ initial?: PatientOption | null; patient: PatientOption }>();
  const selected = choice && choice.initial?.id === defaultPatient?.id ? choice.patient : defaultPatient;

  const { data } = useQuery({
    queryKey: ["patients-search", query],
    queryFn: async (): Promise<{ patients: PatientOption[] }> => {
      const res = await fetch(`/api/patients/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Failed to search patients");
      return res.json();
    },
    enabled: open,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="flex items-center gap-2 truncate">
            <UserRound className="text-muted-foreground size-4 shrink-0" />
            {selected ? `${selected.fullName} · ${selected.patientCode}` : "Select patient…"}
          </span>
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search patients…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No patients found.</CommandEmpty>
            <CommandGroup>
              {data?.patients.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => {
                    setChoice({ initial: defaultPatient, patient: p });
                    onSelect?.(p);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", selected?.id === p.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span>{p.fullName}</span>
                    <span className="text-muted-foreground text-xs">
                      {p.patientCode} · {p.phone}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
