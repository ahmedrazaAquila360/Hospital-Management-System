import "server-only";
import { prisma } from "@/lib/prisma";
import { hospitalZone } from "@/server/reports/calendar";
import { validDay } from "@/lib/report-calendar";

export async function appointmentInstant(date: string, time: string, zone?: string) {
  if (!validDay(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Invalid appointment date or time.");
  const timeZone = zone ?? await hospitalZone();
  const local = `${date} ${time}:00`;
  const [row] = await prisma.$queryRaw<{ instant: Date; roundtrip: string }[]>`
    SELECT ((${local}::timestamp AT TIME ZONE ${timeZone}) AT TIME ZONE 'UTC') AS instant,
      to_char((${local}::timestamp AT TIME ZONE ${timeZone}) AT TIME ZONE ${timeZone}, 'YYYY-MM-DD HH24:MI:SS') AS roundtrip`;
  if (row.roundtrip !== local) throw new Error("This local time does not exist because of a timezone clock change.");
  return row.instant;
}
