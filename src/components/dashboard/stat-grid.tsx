"use client";

import { motion } from "framer-motion";
import {
  Users,
  CalendarDays,
  CheckCircle2,
  Clock,
  CircleDollarSign,
  TriangleAlert,
  UserRoundPlus,
  Stethoscope,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";

const ICONS = {
  users: Users,
  "calendar-days": CalendarDays,
  "check-circle": CheckCircle2,
  clock: Clock,
  "circle-dollar-sign": CircleDollarSign,
  "triangle-alert": TriangleAlert,
  "user-round-plus": UserRoundPlus,
  stethoscope: Stethoscope,
} as const;

export type StatIconKey = keyof typeof ICONS;

export type StatEntry = {
  label: string;
  value: string;
  icon: StatIconKey;
  hint?: string;
  tone?: "primary" | "success" | "warning" | "destructive";
};

export function StatGrid({ stats }: { stats: StatEntry[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.04, ease: "easeOut" }}
        >
          <StatCard {...stat} icon={ICONS[stat.icon]} />
        </motion.div>
      ))}
    </div>
  );
}
