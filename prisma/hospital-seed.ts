import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { BUILT_IN_ROLES, PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "../src/lib/permissions";

async function seed() {
  if (process.env.NODE_ENV === "production") throw new Error("Synthetic seeding is disabled in production.");
  const password = process.env.HOSPITAL_DEMO_PASSWORD;
  if (!password || password.length < 16)
    throw new Error("Set HOSPITAL_DEMO_PASSWORD to at least 16 characters for the development accounts.");
  const hash = await bcrypt.hash(password, 12);
  await prisma.$transaction(
    async (tx) => {
      const department = await tx.department.upsert({
        where: { branchId_name: {branchId: "branch-main", name: "General Medicine"} },
        update: {},
        create: { name: "General Medicine" },
      });
      const permissions = new Map<string, string>();
      for (const p of PERMISSIONS) {
        const record = await tx.permission.upsert({ where: { key: p.key }, update: {}, create: p });
        permissions.set(p.key, record.id);
      }
      for (const def of BUILT_IN_ROLES) {
        const existing = await tx.role.findUnique({ where: { name: def.name } });
        const role = existing ?? (await tx.role.create({ data: def }));
        if (!existing)
          await tx.rolePermission.createMany({
            data: DEFAULT_ROLE_PERMISSIONS[def.name].map((key) => ({
              roleId: role.id,
              permissionId: permissions.get(key)!,
            })),
          });
        const email = `${def.name === "DENTIST" ? "doctor" : def.name.toLowerCase()}@hospital.example`;
        await tx.user.upsert({
          where: { email },
          update: {},
          create: {
            name: `Demo ${def.label}`,
            email,
            passwordHash: hash,
            roleId: role.id,
            departmentId: department.id,
          },
        });
      }
      await tx.clinicSettings.upsert({
        where: { id: "hospital-default" },
        update: {},
        create: { id: "hospital-default", clinicName: "General Hospital" },
      });
    },
    { timeout: 30000 },
  );
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
