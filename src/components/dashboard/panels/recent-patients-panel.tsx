import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PanelCard } from "@/components/dashboard/panels/panel-card";
import { formatRelative, initialsFromName } from "@/lib/format";
import { UserRoundPlus } from "lucide-react";
import type { getRecentPatients } from "@/server/dashboard/queries";

type Patient = Awaited<ReturnType<typeof getRecentPatients>>[number];

export function RecentPatientsPanel({ patients }: { patients: Patient[] }) {
  return (
    <PanelCard title="Recent Patients" viewAllHref="/patients">
      {patients.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <UserRoundPlus />
          </EmptyMedia>
          <EmptyTitle>No patients yet</EmptyTitle>
          <EmptyDescription>New patients will appear here.</EmptyDescription>
        </Empty>
      ) : (
        <ul className="-mx-2">
          {patients.map((p) => (
            <li key={p.id}>
              <Link
                href={`/patients/${p.id}`}
                className="hover:bg-pale/60 flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors"
              >
                <Avatar className="size-10">
                  <AvatarFallback className="bg-linear-to-br from-[#e3f4fd] to-[#cbe8fa] text-xs font-semibold text-navy">
                    {initialsFromName(p.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.fullName}</p>
                  <p className="text-muted-foreground truncate text-xs">{p.patientCode}</p>
                </div>
                <span className="text-muted-foreground shrink-0 text-xs">{formatRelative(p.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}
