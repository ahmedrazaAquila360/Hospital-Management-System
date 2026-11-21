import { Stethoscope } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Progress } from "@/components/ui/progress";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { formatCurrency, formatDate, toNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TREATMENT_STATUS_ACCENT, TREATMENT_STATUS_TONE } from "@/lib/status";
import type { getPatientById } from "@/server/patients/queries";

type Patient = NonNullable<Awaited<ReturnType<typeof getPatientById>>>;

export function TreatmentsTab({ patient }: { patient: Patient }) {
  if (patient.treatments.length === 0) {
    return (
      <Card>
        <CardContent>
          <Empty>
            <EmptyMedia variant="icon">
              <Stethoscope />
            </EmptyMedia>
            <EmptyTitle>No treatments yet</EmptyTitle>
            <EmptyDescription>Treatment plans for this patient will appear here.</EmptyDescription>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {patient.treatments.map((t) => {
        const cost = toNumber(t.cost);
        const discount = toNumber(t.discount);
        const net = cost - discount;
        const progress = t.status === "COMPLETED" ? 100 : t.status === "IN_PROGRESS" ? 50 : t.status === "PLANNED" ? 10 : 0;
        const accent = TREATMENT_STATUS_ACCENT[t.status];

        return (
          <Card key={t.id} className={cn("border-l-4", accent.edge)}>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-muted-foreground text-xs">
                    Dr. {t.dentist.name.replace(/^Dr\.\s*/, "")} · started {t.startDate ? formatDate(t.startDate) : "—"}
                    {t.teeth.length > 0 && ` · Teeth ${t.teeth.map((tt) => tt.tooth.toothNumber).join(", ")}`}
                  </p>
                  {t.description && <p className="text-muted-foreground mt-1 text-sm">{t.description}</p>}
                </div>
                <StatusBadge status={t.status} tone={TREATMENT_STATUS_TONE[t.status]} className={accent.badge} />
              </div>
              <Progress value={progress} className={cn("h-1.5", accent.bar)} />
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Cost</p>
                  <p className="font-medium">{formatCurrency(net)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Discount</p>
                  <p className="font-medium">{formatCurrency(discount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Expected Completion</p>
                  <p className="font-medium">{t.expectedCompletionDate ? formatDate(t.expectedCompletionDate) : "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
