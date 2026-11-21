"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { AXIS_TICK, ChartHeader, ChartTooltip, GRID_STROKE } from "@/components/dashboard/charts/chart-parts";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export function RevenueChart({ data, className }: { data: { month: string; revenue: number }[]; className?: string }) {
  const total = data.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <Card className={cn("col-span-full lg:col-span-2", className)}>
      <ChartHeader
        title="Revenue Overview"
        description="Payments received, last 6 months"
        aside={
          <div className="text-right">
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">6-month total</p>
            <p className="font-heading text-navy text-xl font-semibold tracking-tight tabular">{formatCurrency(total)}</p>
          </div>
        }
      />
      <CardContent className="h-72 pl-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={AXIS_TICK} tickMargin={10} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              tick={AXIS_TICK}
              tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
            />
            <Tooltip
              cursor={{ stroke: "var(--chart-1)", strokeOpacity: 0.25, strokeWidth: 1 }}
              content={<ChartTooltip formatValue={(v) => formatCurrency(v)} />}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#revenueFill)"
              dot={false}
              activeDot={{ r: 5, fill: "var(--chart-1)", stroke: "#fff", strokeWidth: 2 }}
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
