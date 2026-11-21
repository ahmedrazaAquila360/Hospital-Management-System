import { CONDITION_META, LOWER_LEFT, LOWER_RIGHT, UPPER_LEFT, UPPER_RIGHT, type ToothConditionKey } from "@/lib/dental";
import { cn } from "@/lib/utils";

type ToothState = { toothNumber: number; currentCondition: ToothConditionKey };

function ToothDot({ tooth }: { tooth?: ToothState }) {
  const condition = tooth?.currentCondition ?? "HEALTHY";
  const meta = CONDITION_META[condition];
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          "border-border/70 flex size-6 items-center justify-center rounded-full border text-[9px] font-medium",
          condition === "MISSING" && "border-dashed opacity-50"
        )}
        style={{ background: meta.color, color: meta.textColor }}
        title={`${tooth?.toothNumber ?? ""} · ${meta.label}`}
      >
        {condition === "MISSING" ? "" : ""}
      </div>
      <span className="text-muted-foreground text-[10px]">{tooth?.toothNumber}</span>
    </div>
  );
}

export function MiniOdontogram({ teeth }: { teeth: ToothState[] }) {
  const byNumber = new Map(teeth.map((t) => [t.toothNumber, t]));

  const rows: number[][] = [
    [...UPPER_RIGHT, ...UPPER_LEFT],
    [...[...LOWER_RIGHT].reverse(), ...LOWER_LEFT],
  ];

  return (
    <div className="flex flex-col items-center gap-3 overflow-x-auto py-2">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2">
          {row.map((n) => (
            <ToothDot key={n} tooth={byNumber.get(n)} />
          ))}
        </div>
      ))}
    </div>
  );
}
