"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { AXIS_TICK, ChartHeader, ChartTooltip, GRID_STROKE } from "@/components/dashboard/charts/chart-parts";
import { Stethoscope } from "lucide-react";

export function TreatmentStatsChart({ data }: { data: { name: string; count: number }[] }) {
  return (
    <Card>
      <ChartHeader title="Treatment Statistics" description="Most frequent treatments" />
      <CardContent className="h-72 pl-0">
        {data.length === 0 ? (
          <Empty className="h-full">
            <EmptyMedia variant="icon">
              <Stethoscope />
            </EmptyMedia>
            <EmptyTitle>No treatments yet</EmptyTitle>
            <EmptyDescription>Treatment activity will show up here.</EmptyDescription>
          </Empty>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                width={130}
                tick={{ ...AXIS_TICK, fill: "var(--foreground)" }}
              />
              <Tooltip cursor={{ fill: "var(--pale)" }} content={<ChartTooltip />} />
              <Bar dataKey="count" name="Treatments" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={16} animationDuration={800}>
                <LabelList dataKey="count" position="right" offset={8} fill="var(--muted-foreground)" fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
