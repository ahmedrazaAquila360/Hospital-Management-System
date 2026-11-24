import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createPrismaClient() {
  if (!process.env.HOSPITAL_DATABASE_URL) throw new Error("Configure HOSPITAL_DATABASE_URL for the hospital database.");
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.HOSPITAL_DATABASE_URL }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    // Never return password hashes unless a query asks with `omit: { passwordHash: false }`
    // (only sign-in and change-password do). Pages pass user rows (dentist pickers,
    // `include: { dentist: true }`, staff forms) straight to client components, which
    // put every hash in the HTML, including on the public /book page.
    omit: { user: { passwordHash: true } },
  });
}

const globalForPrisma = globalThis as unknown as {
  hospitalBasePrisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const basePrisma = globalForPrisma.hospitalBasePrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.hospitalBasePrisma = basePrisma;
}
