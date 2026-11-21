"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import type { RequestStatus } from "@/generated/prisma/enums";

export async function updateAppointmentRequestStatusAction(id: string, status: RequestStatus) {
  const user = await requirePermission("appointments.requests");
  await prisma.appointmentRequest.update({
    where: { id },
    data: { status, reviewedById: user.id, reviewedAt: new Date() },
  });

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "STATUS_CHANGE",
      entityType: "AppointmentRequest",
      entityId: id,
      description: `${user.name} marked a website booking request as ${status.toLowerCase()}.`,
    },
  });

  revalidatePath("/appointments/requests");
}
