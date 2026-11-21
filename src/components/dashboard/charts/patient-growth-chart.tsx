"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { AXIS_TICK, ChartHeader, ChartTooltip, GRID_STROKE } from "@/components/dashboard/charts/chart-parts";

export function PatientGrowthChart({ data }: { data: { month: string; patients: number }[] }) {
  return (
    <Card>
      <ChartHeader title="Patient Growth" description="New patients per month" />
      <CardContent className="h-64 pl-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" />
                <stop offset="100%" stopColor="var(--chart-1)" />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={AXIS_TICK} tickMargin={10} />
            <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} tick={AXIS_TICK} />
            <Tooltip cursor={{ fill: "var(--pale)" }} content={<ChartTooltip />} />
            <Bar
              dataKey="patients"
              name="New patients"
              fill="url(#growthFill)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              animationDuration={800}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
