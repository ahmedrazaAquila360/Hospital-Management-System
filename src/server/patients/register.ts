import "server-only";
import {prisma} from "@/lib/prisma";
import {basePrisma} from "@/lib/prisma-base";
import {can,type SessionUser} from "@/lib/permissions";
import {patientSchema,type PatientInput} from "@/lib/validations/patient";
import {ToothCondition} from "@/generated/prisma/enums";
const FDI_TEETH = [
  ...[18, 17, 16, 15, 14, 13, 12, 11],
  ...[21, 22, 23, 24, 25, 26, 27, 28],
  ...[38, 37, 36, 35, 34, 33, 32, 31],
  ...[41, 42, 43, 44, 45, 46, 47, 48],
];

export async function registerPatient(input:PatientInput,user:SessionUser,photoUrl:string|null=null){
 if(!can(user,"patients.create"))throw new Error("Patient registration permission required.");
 const data=patientSchema.parse(input);
  const result = await prisma.$transaction(async tx => {
    const identity = JSON.stringify([data.fullName.toLowerCase().trim(),data.dob,data.phone.trim()]);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identity},0))`;
    const duplicate = await tx.patient.findFirst({
      where: { fullName: { equals: data.fullName.trim(), mode: "insensitive" }, dob: new Date(data.dob), phone: data.phone.trim() },
      select: { patientCode: true },
    });
    if (duplicate) return { duplicate: duplicate.patientCode };
    // Central identity check reveals no other branch's clinical record or MRN.
    const elsewhere = await basePrisma.patient.count({where: {fullName: {equals: data.fullName.trim(), mode: "insensitive"}, dob: new Date(data.dob), phone: data.phone.trim()}});
    if (elsewhere) return {duplicate: "already registered at another branch; use the existing hospital MRN to enroll"};

    const [{ serial }] = await tx.$queryRaw<{ serial: bigint }[]>`SELECT nextval('hospital_mrn') AS serial`;
    const patientCode = `MRN-${String(serial).padStart(7, "0")}`;

    const patient = await tx.patient.create({
      data: {
        patientCode,
        fullName: data.fullName,
        photoUrl,
        dob: new Date(data.dob),
        gender: data.gender,
        phone: data.phone,
        email: data.email || null,
        address: data.address || null,
        emergencyContactName: data.emergencyContactName || null,
        emergencyContactPhone: data.emergencyContactPhone || null,
        bloodGroup: data.bloodGroup,
        insuranceInfo: data.insuranceInfo,
        surgicalHistory: data.surgicalHistory,
        allergies: data.allergies || null,
        currentMedications: data.currentMedications || null,
        notes: data.notes || null,
        createdById: user.id,
        medicalHistory: {
          create: {
            hasDiabetes: data.hasDiabetes,
            hasHypertension: data.hasHypertension,
            hasHeartCondition: data.hasHeartCondition,
            hasBleedingDisorder: data.hasBleedingDisorder,
            isPregnant: data.isPregnant,
            isSmoker: data.isSmoker,
            otherConditions: data.otherConditions || null,
            previousDentalHistory: data.previousDentalHistory || null,
          },
        },
        dentalRecord: {
          create: {
            teeth: {
              create: FDI_TEETH.map((toothNumber) => ({ toothNumber, currentCondition: ToothCondition.HEALTHY })),
            },
          },
        },
      },
    });

    await tx.activityLog.create({
      data: {
        userId: user.id,
        action: "CREATE",
        entityType: "Patient",
        entityId: patient.id,
        description: `${user.name} registered new patient ${patient.fullName} (${patient.patientCode}).`,
      },
    });

    const admins = await tx.user.findMany({
      where: { role: { name: { in: ["SUPER_ADMIN", "ADMIN"] } } },
      select: { id: true },
    });
    if (admins.length) {
      await tx.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type: "PATIENT_NEW" as const,
          title: "New patient registered",
          message: `${patient.fullName} was added by ${user.name}.`,
          link: `/patients/${patient.id}`,
        })),
      });
    }
    return { patient };
  });
 return result;
}
