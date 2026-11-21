import type { User } from "@/generated/prisma/client";

/**
 * A user row as Prisma returns it by default here: `passwordHash` is omitted globally
 * (src/lib/prisma.ts). Type component props with this, never `User`, so a hash can't be
 * required by, and therefore can't be passed to, anything rendered for the browser.
 */
export type SafeUser = Omit<User, "passwordHash">;
