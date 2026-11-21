import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { MiniOdontogram } from "@/components/dental-chart/mini-odontogram";
import { CONDITION_META } from "@/lib/dental";
import { formatDate } from "@/lib/format";
import { Grid3x3 } from "lucide-react";
import type { getPatientById } from "@/server/patients/queries";

type Patient = NonNullable<Awaited<ReturnType<typeof getPatientById>>>;

export function DentalHistoryTab({ patient }: { patient: Patient }) {
  const teeth = patient.dentalRecord?.teeth ?? [];
  const abnormalTeeth = teeth.filter((t) => t.currentCondition !== "HEALTHY");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Dental Chart</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href={`/dental-chart?patientId=${patient.id}`}>
              Open Full Chart <ArrowUpRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <MiniOdontogram teeth={teeth} />
          <div className="mt-4 flex flex-wrap gap-3 border-t pt-4">
            {Object.entries(CONDITION_META).map(([key, meta]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs">
                <span className="border-border/70 size-3 rounded-full border" style={{ background: meta.color }} />
                {meta.label}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Condition History</CardTitle>
        </CardHeader>
        <CardContent>
          {abnormalTeeth.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <Grid3x3 />
              </EmptyMedia>
              <EmptyTitle>All teeth healthy</EmptyTitle>
              <EmptyDescription>No conditions have been recorded yet.</EmptyDescription>
            </Empty>
          ) : (
            <div className="divide-y">
              {abnormalTeeth.map((tooth) => (
                <div key={tooth.id} className="flex flex-col gap-2 py-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-transparent font-medium"
                      style={{
                        background: CONDITION_META[tooth.currentCondition].color,
                        color: CONDITION_META[tooth.currentCondition].textColor,
                      }}
                    >
                      Tooth {tooth.toothNumber}
                    </Badge>
                    <span className="text-sm font-medium">{CONDITION_META[tooth.currentCondition].label}</span>
                    {tooth.notes && <span className="text-muted-foreground text-sm">— {tooth.notes}</span>}
                  </div>
                  {tooth.conditions.length > 0 && (
                    <ul className="text-muted-foreground space-y-0.5 pl-1 text-xs">
                      {tooth.conditions.slice(0, 3).map((c) => (
                        <li key={c.id}>
                          {formatDate(c.recordedAt)} — {CONDITION_META[c.condition].label}
                          {c.recordedBy ? ` by ${c.recordedBy.name}` : ""}
                          {c.notes ? `: ${c.notes}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
