import "server-only";
import { prisma } from "@/lib/prisma";
import { parseWorkingHours } from "@/lib/working-hours";

export async function getClinicSettings() {
  const settings = await prisma.clinicSettings.findFirst();
  if (settings) return settings;
  return prisma.clinicSettings.create({
    data: { clinicName: "General Hospital", currency: "USD", dateFormat: "MM/dd/yyyy", timeZone: "UTC" },
  });
}

/** The clinic's working hours (see lib/working-hours), or null when none are set. */
export async function getWorkingHours() {
  const settings = await prisma.clinicSettings.findFirst({ select: { workingHours: true } });
  return parseWorkingHours(settings?.workingHours ?? null);
}
