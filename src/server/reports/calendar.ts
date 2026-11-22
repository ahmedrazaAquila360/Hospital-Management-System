import "server-only";
import { prisma } from "@/lib/prisma";

/** Convert inclusive calendar dates to an exclusive-end UTC interval, including DST. */
export async function calendarBounds(first: string, last: string, zone: string) {
  const [bounds] = await prisma.$queryRaw<{ start: Date; end: Date }[]>`
    SELECT ((${first}::date::timestamp AT TIME ZONE ${zone}) AT TIME ZONE 'UTC') AS start,
      (((${last}::date + 1)::timestamp AT TIME ZONE ${zone}) AT TIME ZONE 'UTC') AS "end"`;
  return bounds;
}

export async function hospitalZone() {
  return (await prisma.clinicSettings.findFirst({ select: { timeZone: true } }))?.timeZone ?? "UTC";
}
