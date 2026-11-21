"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { WEEK_DAYS, validateWorkingHours, type WorkingHours } from "@/lib/working-hours";

export async function saveDoctor(form: FormData) {
  await requirePermission("staff.edit");
  const data = z
    .object({
      userId: z.string().min(1),
      qualifications: z.string().trim().max(1000),
      specialty: z.string().trim().max(150),
      consultationFee: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/),
    })
    .parse(Object.fromEntries(form));
  const hours = Object.fromEntries(
    WEEK_DAYS.map(({ key }) => [
      key,
      {
        closed: !form.has(key),
        shifts: form.has(key)
          ? [{ open: String(form.get(key + "Open")), close: String(form.get(key + "Close")) }]
          : [],
      },
    ]),
  ) as WorkingHours;
  const problem = validateWorkingHours(hours);
  if (problem) throw new Error(problem);
  await prisma.user.findFirstOrThrow({ where: { id: data.userId, role: { name: "DENTIST" } } });
  await prisma.doctorProfile.upsert({
    where: { userId: data.userId },
    create: { ...data, hours },
    update: { ...data, hours },
  });
  revalidatePath("/doctors");
}
