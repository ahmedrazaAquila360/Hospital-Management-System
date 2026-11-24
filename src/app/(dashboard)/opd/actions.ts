"use server";

import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, assertPermission } from "@/lib/auth/guard";
import { encounterScope } from "@/server/encounters/scope";
import { prisma } from "@/lib/prisma";
import { vitalFields } from "./vitals";

export async function documentVisit(form: FormData) {
  const doctor = await requirePermission("opd.edit");
  assertPermission(doctor, "opd.view");
  const data = z
    .object({
      encounterId: z.string().min(1),
      diagnosis: z.string().trim().min(1).max(2000),
      narrative: z.string().trim().min(1).max(8000),
      instructions: z.string().trim().max(4000),
      followUp: z.union([z.literal(""), z.iso.date()]),
    })
    .parse(Object.fromEntries(form));
  const vitals: Record<string, number> = {};
  for (const [key] of vitalFields) {
    const value = form.get(key);
    if (value !== "" && value !== null)
      vitals[key] = z.coerce
        .number()
        .nonnegative()
        .max(key === "saturation" ? 100 : 10000)
        .parse(value);
  }
  await prisma.$transaction(async (tx) => {
    const visit = await tx.encounter.findFirstOrThrow({
      where: { id: data.encounterId, ...encounterScope(doctor) },
      select: { appointmentId: true },
    });
    const previousId = form.get("previousId");
    let reason: string | undefined;
    if (typeof previousId === "string" && previousId) {
      reason = z.string().trim().min(1).max(1000).parse(form.get("amendmentReason"));
      await tx.clinicalNote.findFirstOrThrow({ where: { id:previousId, encounterId:data.encounterId, amendment:null, ...(can(doctor,"opd.manage") ? {} : { authorId:doctor.id }) } });
    }
    const note = await tx.clinicalNote.create({
      data: {
        previousId: typeof previousId === "string" ? previousId : null, amendmentReason:reason,
        authorId: doctor.id,
        encounterId: data.encounterId,
        diagnosis: data.diagnosis,
        narrative: data.narrative,
        instructions: data.instructions,
        followUp: data.followUp ? new Date(data.followUp) : null,
        vitals,
      },
    });
    if (data.followUp && !reason) {
      const patientId = visit.appointmentId
        ? (await tx.appointment.findUniqueOrThrow({where:{id:visit.appointmentId},select:{patientId:true}})).patientId
        : (await tx.encounter.findUniqueOrThrow({where:{id:data.encounterId},select:{admission:{select:{patientId:true}}}})).admission?.patientId;
      if(patientId)await tx.followUp.create({data:{patientId,noteId:note.id,dueDate:new Date(data.followUp)}});
    }
    if (visit.appointmentId)
      await tx.appointment.updateMany({
        where: { id: visit.appointmentId, status: "CHECKED_IN" },
        data: { status: "IN_PROGRESS" },
      });
    await tx.activityLog.create({
      data: { userId: doctor.id, entityType: "ClinicalNote", entityId: note.id, action: reason ? "AMEND" : "CREATE" },
    });
  });
  revalidatePath("/opd");
  revalidatePath("/appointments");
  if (form.has("previousId")) redirect("/opd?visit=" + data.encounterId);
}
