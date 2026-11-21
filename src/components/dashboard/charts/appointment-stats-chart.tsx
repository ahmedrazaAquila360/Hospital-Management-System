"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { AXIS_TICK, ChartHeader, ChartLegend, ChartTooltip, GRID_STROKE } from "@/components/dashboard/charts/chart-parts";

type Row = { day: string; completed: number; cancelled: number; scheduled: number };

// Fixed categorical order (validated for colour-vision deficiency): deep blue · cyan · orange.
const SERIES = [
  { key: "completed", label: "Completed", color: "var(--chart-3)" },
  { key: "scheduled", label: "Scheduled", color: "var(--chart-2)" },
  { key: "cancelled", label: "Cancelled/No-show", color: "var(--chart-5)" },
] as const;

export function AppointmentStatsChart({ data }: { data: Row[] }) {
  return (
    <Card>
      <ChartHeader title="Appointment Statistics" description="Last 7 days" />
      <CardContent className="flex h-72 flex-col gap-3 pl-0">
        <div className="pl-5">
          <ChartLegend items={SERIES.map((s) => ({ label: s.label, color: s.color }))} />
        </div>
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID_STROKE} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={AXIS_TICK} tickMargin={10} />
              <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} tick={AXIS_TICK} />
              <Tooltip cursor={{ fill: "var(--pale)" }} content={<ChartTooltip />} />
              {SERIES.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stackId="a"
                  fill={s.color}
                  stroke="var(--card)"
                  strokeWidth={2}
                  maxBarSize={24}
                  radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  animationDuration={800}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
