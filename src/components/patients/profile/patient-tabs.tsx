"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function PatientTabs({ tabs }: { tabs: { key: string; label: string; content: ReactNode }[] }) {
  const requested = useSearchParams().get("tab");
  return <Tabs defaultValue={tabs.find(t => t.key === requested)?.key ?? "overview"}>
    <TabsList className="w-full justify-start overflow-x-auto">{tabs.map(t => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}</TabsList>
    {tabs.map(t => <TabsContent key={t.key} value={t.key} className="mt-4">{t.content}</TabsContent>)}
  </Tabs>;
}
