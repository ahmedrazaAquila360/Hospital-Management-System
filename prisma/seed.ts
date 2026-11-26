import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { BUILT_IN_ROLES, DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from "../src/lib/permissions";
import { ToothCondition } from "../src/generated/prisma/enums";

const DEMO_PASSWORD = process.env.HOSPITAL_DEMO_PASSWORD;


const FDI_TEETH = [
  ...[18, 17, 16, 15, 14, 13, 12, 11],
  ...[21, 22, 23, 24, 25, 26, 27, 28],
  ...[38, 37, 36, 35, 34, 33, 32, 31],
  ...[41, 42, 43, 44, 45, 46, 47, 48],
];

function daysFrom(base: Date, offset: number, hour = 0, minute = 0) {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/**
 * Calendar-only date (for @db.Date columns) built as UTC midnight, matching
 * how `new Date("YYYY-MM-DD")` parses — avoids the local-midnight-shifts-a-day
 * bug that a plain local Date would hit once round-tripped through Postgres DATE.
 */
function dateOnly(base: Date, offset: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return new Date(`${y}-${m}-${day}T00:00:00Z`);
}

function money(n: number) {
  return n.toFixed(2);
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Synthetic seed is disabled in production.");
  if (!DEMO_PASSWORD || DEMO_PASSWORD.length < 16) throw new Error("Set HOSPITAL_DEMO_PASSWORD to at least 16 characters for development seeding.");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log("Seeding permissions...");
  const permissionByKey = new Map<string, string>();
  for (const p of PERMISSIONS) {
    const rec = await prisma.permission.upsert({
      where: { key: p.key },
      update: { label: p.label, module: p.module },
      create: { key: p.key, label: p.label, module: p.module },
    });
    permissionByKey.set(p.key, rec.id);
  }

  console.log("Seeding roles + default permissions (only for roles without any)...");
  const roleByName = new Map<string, string>();
  for (const def of BUILT_IN_ROLES) {
    const role = await prisma.role.upsert({
      where: { name: def.name },
      update: {},
      create: { name: def.name, label: def.label, description: def.description },
    });
    roleByName.set(def.name, role.id);

    const existing = await prisma.rolePermission.count({ where: { roleId: role.id } });
    if (existing === 0) {
      await prisma.rolePermission.createMany({
        data: DEFAULT_ROLE_PERMISSIONS[def.name].map((key) => ({ roleId: role.id, permissionId: permissionByKey.get(key)! })),
        skipDuplicates: true,
      });
    }
  }

  console.log("Seeding clinic settings...");
  const existingSettings = await prisma.clinicSettings.findFirst();
  if (!existingSettings) {
    await prisma.clinicSettings.create({
      data: {
        clinicName: process.env.CLINIC_NAME ?? "Bright Smile Dental Clinic",
        address: "221B Baker Street, Suite 400, Springfield",
        phone: "+1 (555) 010-2200",
        email: "hello@brightsmile.example",
        website: "https://brightsmile.example",
        currency: "USD",
        dateFormat: "MM/dd/yyyy",
        timeZone: "America/New_York",
        workingHours: {
          mon: { open: "09:00", close: "18:00" },
          tue: { open: "09:00", close: "18:00" },
          wed: { open: "09:00", close: "18:00" },
          thu: { open: "09:00", close: "18:00" },
          fri: { open: "09:00", close: "17:00" },
          sat: { open: "10:00", close: "14:00" },
          sun: { closed: true },
        },
      },
    });
  }

  console.log("Seeding users...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  async function upsertUser(opts: {
    name: string;
    email: string;
    role: string;
    phone: string;
    joiningDate: Date;
  }) {
    return prisma.user.upsert({
      where: { email: opts.email },
      update: { name: opts.name, roleId: roleByName.get(opts.role)! },
      create: {
        name: opts.name,
        email: opts.email,
        passwordHash,
        phone: opts.phone,
        roleId: roleByName.get(opts.role)!,
        joiningDate: opts.joiningDate,
      },
    });
  }

  const superAdmin = await upsertUser({
    name: "Ava Whitfield",
    email: "superadmin@dentalhub.dev",
    role: "SUPER_ADMIN",
    phone: "+1 (555) 010-0001",
    joiningDate: daysFrom(today, -900),
  });
  const admin = await upsertUser({
    name: "Marcus Cole",
    email: "admin@dentalhub.dev",
    role: "ADMIN",
    phone: "+1 (555) 010-0002",
    joiningDate: daysFrom(today, -700),
  });
  const dentist1 = await upsertUser({
    name: "Dr. Sarah Chen",
    email: "dr.chen@dentalhub.dev",
    role: "DENTIST",
    phone: "+1 (555) 010-0101",
    joiningDate: daysFrom(today, -640),
  });
  const dentist2 = await upsertUser({
    name: "Dr. James Okafor",
    email: "dr.okafor@dentalhub.dev",
    role: "DENTIST",
    phone: "+1 (555) 010-0102",
    joiningDate: daysFrom(today, -520),
  });
  const dentist3 = await upsertUser({
    name: "Dr. Priya Nair",
    email: "dr.nair@dentalhub.dev",
    role: "DENTIST",
    phone: "+1 (555) 010-0103",
    joiningDate: daysFrom(today, -300),
  });
  const receptionist = await upsertUser({
    name: "Elena Vargas",
    email: "receptionist@dentalhub.dev",
    role: "RECEPTIONIST",
    phone: "+1 (555) 010-0201",
    joiningDate: daysFrom(today, -400),
  });
  const receptionist2 = await upsertUser({
    name: "Noah Bennett",
    email: "front.desk@dentalhub.dev",
    role: "RECEPTIONIST",
    phone: "+1 (555) 010-0202",
    joiningDate: daysFrom(today, -180),
  });
  const staff = await upsertUser({
    name: "Lucas Ferreira",
    email: "staff@dentalhub.dev",
    role: "STAFF",
    phone: "+1 (555) 010-0301",
    joiningDate: daysFrom(today, -250),
  });

  const dentists = [dentist1, dentist2, dentist3];

  console.log("Seeding patients...");
  const patientSeeds = [
    { name: "Olivia Martinez", dob: "1990-04-12", gender: "FEMALE", phone: "+1 (555) 200-1001", blood: "O_POS", allergy: "Penicillin" },
    { name: "Ethan Walker", dob: "1985-11-03", gender: "MALE", phone: "+1 (555) 200-1002", blood: "A_POS", allergy: null },
    { name: "Sophia Lee", dob: "2001-07-22", gender: "FEMALE", phone: "+1 (555) 200-1003", blood: "B_NEG", allergy: "Latex" },
    { name: "Liam Johnson", dob: "1978-02-17", gender: "MALE", phone: "+1 (555) 200-1004", blood: "AB_POS", allergy: null },
    { name: "Ava Thompson", dob: "1995-09-30", gender: "FEMALE", phone: "+1 (555) 200-1005", blood: "O_NEG", allergy: "Ibuprofen" },
    { name: "Noah Rodriguez", dob: "2010-01-05", gender: "MALE", phone: "+1 (555) 200-1006", blood: "A_NEG", allergy: null },
    { name: "Isabella Clark", dob: "1988-06-14", gender: "FEMALE", phone: "+1 (555) 200-1007", blood: "B_POS", allergy: null },
    { name: "Mason Lewis", dob: "1999-12-25", gender: "MALE", phone: "+1 (555) 200-1008", blood: "O_POS", allergy: "Aspirin" },
    { name: "Mia Robinson", dob: "1972-03-19", gender: "FEMALE", phone: "+1 (555) 200-1009", blood: "AB_NEG", allergy: null },
    { name: "Lucas Hall", dob: "1965-10-08", gender: "MALE", phone: "+1 (555) 200-1010", blood: "A_POS", allergy: "Codeine" },
    { name: "Charlotte Young", dob: "1993-05-27", gender: "FEMALE", phone: "+1 (555) 200-1011", blood: "O_POS", allergy: null },
    { name: "Benjamin King", dob: "1982-08-11", gender: "MALE", phone: "+1 (555) 200-1012", blood: "B_NEG", allergy: null },
  ] as const;

  const patients = [];
  let patientSeq = 1;
  for (const seed of patientSeeds) {
    const patientCode = `PT-${String(patientSeq).padStart(5, "0")}`;
    patientSeq++;

    const patient = await prisma.patient.upsert({
      where: { patientCode },
      update: {},
      create: {
        patientCode,
        fullName: seed.name,
        dob: new Date(seed.dob),
        gender: seed.gender as "MALE" | "FEMALE",
        phone: seed.phone,
        email: `${seed.name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        address: "12 Maple Street, Springfield",
        emergencyContactName: "Family Contact",
        emergencyContactPhone: "+1 (555) 200-9999",
        bloodGroup: seed.blood as "O_POS",
        allergies: seed.allergy,
        currentMedications: null,
        notes: null,
        createdById: receptionist.id,
      },
    });
    patients.push(patient);

    await prisma.medicalHistory.upsert({
      where: { patientId: patient.id },
      update: {},
      create: {
        patientId: patient.id,
        hasDiabetes: patientSeq % 7 === 0,
        hasHypertension: patientSeq % 5 === 0,
        hasHeartCondition: false,
        hasBleedingDisorder: false,
        isPregnant: false,
        isSmoker: patientSeq % 6 === 0,
        otherConditions: null,
        previousDentalHistory: "Routine cleanings, no major dental surgery on record.",
      },
    });

    const dentalRecord = await prisma.dentalRecord.upsert({
      where: { patientId: patient.id },
      update: {},
      create: { patientId: patient.id },
    });

    const existingTeeth = await prisma.tooth.count({ where: { dentalRecordId: dentalRecord.id } });
    if (existingTeeth === 0) {
      await prisma.tooth.createMany({
        data: FDI_TEETH.map((toothNumber) => ({
          dentalRecordId: dentalRecord.id,
          toothNumber,
          currentCondition: ToothCondition.HEALTHY,
        })),
      });
    }

    const teeth = await prisma.tooth.findMany({ where: { dentalRecordId: dentalRecord.id } });
    const conditionPlan: Array<[number, ToothCondition, string]> = [
      [16, ToothCondition.CARIES, "Distal caries, sensitive to cold"],
      [26, ToothCondition.FILLED, "Composite filling placed"],
      [36, ToothCondition.ROOT_CANAL, "RCT completed, crown pending"],
      [46, ToothCondition.MISSING, "Extracted prior to clinic records"],
    ];
    const picks = conditionPlan.filter((_, i) => (patientSeq + i) % 3 === 0);
    for (const [toothNumber, condition, note] of picks) {
      const tooth = teeth.find((t) => t.toothNumber === toothNumber);
      if (!tooth) continue;
      await prisma.tooth.update({ where: { id: tooth.id }, data: { currentCondition: condition } });
      await prisma.dentalCondition.create({
        data: {
          toothId: tooth.id,
          condition,
          notes: note,
          recordedById: dentists[patientSeq % dentists.length].id,
          recordedAt: daysFrom(today, -30 - patientSeq),
        },
      });
    }
  }

  console.log("Seeding appointments, treatments, prescriptions, billing, expenses...");

  const appointmentTypes = ["CONSULTATION", "CHECKUP", "CLEANING", "FILLING", "ROOT_CANAL", "FOLLOW_UP"] as const;
  const treatmentCatalog = [
    { name: "Dental Cleaning", cost: 120 },
    { name: "Composite Filling", cost: 220 },
    { name: "Root Canal Therapy", cost: 950 },
    { name: "Tooth Extraction", cost: 180 },
    { name: "Dental Crown", cost: 1100 },
    { name: "Teeth Whitening", cost: 350 },
    { name: "Orthodontic Consultation", cost: 90 },
  ];

  let invoiceSeq = 1;
  const dayOffsets = [-14, -10, -7, -5, -3, -2, -1, 0, 0, 1, 2, 4, 6, 9, 13];

  for (let i = 0; i < patients.length; i++) {
    const patient = patients[i];
    const dentist = dentists[i % dentists.length];
    const numAppointments = 1 + (i % 2);

    for (let a = 0; a < numAppointments; a++) {
      const offset = dayOffsets[(i * 2 + a) % dayOffsets.length];
      const apptDateOnly = dateOnly(today, offset);
      const hour = 9 + ((i + a) % 8);
      const start = daysFrom(today, offset, hour, 0);
      const end = daysFrom(today, offset, hour, 30);

      let status: "SCHEDULED" | "CONFIRMED" | "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
      if (offset < 0) {
        status = (i + a) % 9 === 0 ? "NO_SHOW" : (i + a) % 7 === 0 ? "CANCELLED" : "COMPLETED";
      } else if (offset === 0) {
        status = a === 0 ? "CHECKED_IN" : "CONFIRMED";
      } else {
        status = "SCHEDULED";
      }

      const appointment = await prisma.appointment.create({
        data: {
          patientId: patient.id,
          dentistId: dentist.id,
          date: apptDateOnly,
          startTime: start,
          endTime: end,
          type: appointmentTypes[(i + a) % appointmentTypes.length],
          status,
          notes: a === 0 ? "Routine visit" : "Follow-up visit",
          createdById: [receptionist, receptionist2][i % 2].id,
        },
      });

      // Attach a treatment + invoice + payment to completed visits.
      if (status === "COMPLETED") {
        const catalogItem = treatmentCatalog[(i + a) % treatmentCatalog.length];
        const discount = (i + a) % 4 === 0 ? 20 : 0;
        const treatment = await prisma.treatment.create({
          data: {
            patientId: patient.id,
            dentistId: dentist.id,
            appointmentId: appointment.id,
            name: catalogItem.name,
            description: `${catalogItem.name} performed during scheduled visit.`,
            cost: money(catalogItem.cost),
            discount: money(discount),
            status: a === numAppointments - 1 ? "COMPLETED" : "IN_PROGRESS",
            startDate: apptDateOnly,
            expectedCompletionDate: daysFrom(apptDateOnly, 14),
            completedAt: a === numAppointments - 1 ? apptDateOnly : null,
          },
        });

        const dentalRecord = await prisma.dentalRecord.findUnique({ where: { patientId: patient.id } });
        if (dentalRecord) {
          const teeth = await prisma.tooth.findMany({ where: { dentalRecordId: dentalRecord.id } });
          const tooth = teeth[(i + a * 3) % teeth.length];
          await prisma.treatmentTooth.create({
            data: { treatmentId: treatment.id, toothId: tooth.id, notes: "Primary treatment site" },
          });
        }

        const subtotal = catalogItem.cost;
        const tax = Math.round(subtotal * 0.05 * 100) / 100;
        const total = subtotal - discount + tax;
        const invoiceNumber = `INV-${String(invoiceSeq).padStart(5, "0")}`;
        invoiceSeq++;

        const isPaid = (i + a) % 3 !== 0;
        const paidAmount = isPaid ? total : (i + a) % 2 === 0 ? Math.round(total * 0.5 * 100) / 100 : 0;
        const invoiceStatus = paidAmount >= total ? "PAID" : paidAmount > 0 ? "PARTIALLY_PAID" : "UNPAID";

        const invoice = await prisma.invoice.create({
          data: {
            invoiceNumber,
            patientId: patient.id,
            dentistId: dentist.id,
            date: apptDateOnly,
            subtotal: money(subtotal),
            discount: money(discount),
            tax: money(tax),
            total: money(total),
            status: invoiceStatus,
            createdById: receptionist.id,
            items: {
              create: [
                {
                  treatmentId: treatment.id,
                  description: catalogItem.name,
                  quantity: 1,
                  unitPrice: money(catalogItem.cost),
                  amount: money(catalogItem.cost),
                },
              ],
            },
          },
        });

        if (paidAmount > 0) {
          await prisma.payment.create({
            data: {
              invoiceId: invoice.id,
              patientId: patient.id,
              amount: money(paidAmount),
              method: ["CASH", "CARD", "BANK_TRANSFER", "INSURANCE"][(i + a) % 4] as
                | "CASH"
                | "CARD"
                | "BANK_TRANSFER"
                | "INSURANCE",
              date: apptDateOnly,
              receivedById: [receptionist, receptionist2][a % 2].id,
            },
          });
        }

        if ((i + a) % 2 === 0) {
          await prisma.prescription.create({
            data: {
              patientId: patient.id,
              dentistId: dentist.id,
              appointmentId: appointment.id,
              date: apptDateOnly,
              instructions: "Take medicines after meals. Avoid hard/sticky foods for 48 hours.",
              medicines: {
                create: [
                  { medicineName: "Amoxicillin", dosage: "500mg", frequency: "3x daily", duration: "5 days", instructions: "With food" },
                  { medicineName: "Ibuprofen", dosage: "400mg", frequency: "As needed", duration: "3 days", instructions: "For pain, max 3/day" },
                ],
              },
            },
          });
        }
      }

      // Planned treatment for upcoming visits.
      if (status === "SCHEDULED" || status === "CONFIRMED") {
        const catalogItem = treatmentCatalog[(i + a + 2) % treatmentCatalog.length];
        await prisma.treatment.create({
          data: {
            patientId: patient.id,
            dentistId: dentist.id,
            appointmentId: appointment.id,
            name: catalogItem.name,
            description: `Planned: ${catalogItem.name}`,
            cost: money(catalogItem.cost),
            status: "PLANNED",
            startDate: apptDateOnly,
            expectedCompletionDate: daysFrom(apptDateOnly, 21),
          },
        });
      }
    }
  }

  console.log("Seeding expenses...");
  const expenseSeeds = [
    { title: "Monthly clinic rent", category: "RENT", amount: 3200, offset: -20 },
    { title: "Electricity & water bill", category: "UTILITIES", amount: 410, offset: -18 },
    { title: "Front desk & hygienist salaries", category: "SALARIES", amount: 9800, offset: -15 },
    { title: "Autoclave sterilizer purchase", category: "EQUIPMENT", amount: 2600, offset: -12 },
    { title: "Composite resin & gloves restock", category: "SUPPLIES", amount: 780, offset: -9 },
    { title: "HVAC maintenance", category: "MAINTENANCE", amount: 260, offset: -6 },
    { title: "Local newspaper ad campaign", category: "MARKETING", amount: 450, offset: -4 },
    { title: "Office cleaning service", category: "OTHER", amount: 150, offset: -2 },
  ] as const;
  for (const e of expenseSeeds) {
    await prisma.expense.create({
      data: {
        title: e.title,
        category: e.category,
        amount: money(e.amount),
        date: daysFrom(today, e.offset),
        description: null,
        addedById: admin.id,
      },
    });
  }

  console.log("Seeding notifications...");
  await prisma.notification.createMany({
    data: [
      {
        userId: admin.id,
        type: "PATIENT_NEW",
        title: "New patient registered",
        message: `${patients[0].fullName} was added to the system.`,
        link: `/patients/${patients[0].id}`,
      },
      {
        userId: dentist1.id,
        type: "APPOINTMENT_REMINDER",
        title: "Upcoming appointment today",
        message: "You have appointments scheduled today.",
        link: "/appointments",
      },
      {
        userId: receptionist.id,
        type: "PAYMENT_OUTSTANDING",
        title: "Outstanding balance",
        message: "Some invoices still have an outstanding balance.",
        link: "/billing/invoices",
      },
    ],
  });

  console.log("\nSeed complete.\n");
  console.log("Synthetic development accounts are ready. Use the configured HOSPITAL_DEMO_PASSWORD.");
  const table = [
    ["Super Admin", superAdmin.email],
    ["Admin", admin.email],
    ["Dentist", dentist1.email],
    ["Dentist", dentist2.email],
    ["Dentist", dentist3.email],
    ["Receptionist", receptionist.email],
    ["Receptionist", receptionist2.email],
    ["Staff", staff.email],
  ];
  for (const [role, email] of table) {
    console.log(`  ${role.padEnd(14)} ${email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
