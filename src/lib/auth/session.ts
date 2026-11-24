import "server-only";
import { randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { basePrisma as prisma } from "@/lib/prisma-base";
import { effectivePermissions, type SessionUser } from "@/lib/permissions";

export const SESSION_COOKIE_NAME = "hospital_session";
const DEFAULT_SESSION_DAYS = 7;
const REMEMBER_ME_SESSION_DAYS = 30;

function expiryFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export async function createSession(userId: string, opts: { rememberMe?: boolean } = {}) {
  const membership = await prisma.branchMembership.findFirst({where: {userId, active: true}, orderBy: {branchId: "asc"}});
  if (!membership) throw new Error("No branch has been assigned to this account.");
  const token = randomBytes(32).toString("hex");
  const days = opts.rememberMe ? REMEMBER_ME_SESSION_DAYS : DEFAULT_SESSION_DAYS;
  const expires = expiryFromNow(days);

  const requestHeaders = await headers();

  await prisma.session.create({
    data: {
      sessionToken: token,
      activeBranchId: membership.branchId,
      userId,
      expires,
      userAgent: requestHeaders.get("user-agent") ?? undefined,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });

  return token;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { sessionToken: token } });
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Loads the current session's user (with role + flattened permission keys).
 * Memoized per-request so multiple server components share one DB lookup.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    include: {
      user: {
        include: {
          role: {
            include: { permissions: { include: { permission: true } } },
          },
          permissionOverrides: { select: { granted: true, permission: { select: { key: true } } } },
        },
      },
    },
  });

  if (!session || session.expires < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    }
    return null;
  }

  if (session.user.status !== "ACTIVE") return null;
  const memberships = await prisma.branchMembership.findMany({where: {userId: session.userId, active: true}});
  if (!memberships.some(m => m.branchId === session.activeBranchId)) return null;
  const branches = await prisma.branch.findMany({where: {id: {in: memberships.map(m => m.branchId)}}, select: {id: true, name: true}, orderBy: {name: "asc"}});

  return {
    activeBranchId: session.activeBranchId,
    branches,
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    phone: session.user.phone,
    avatarUrl: session.user.avatarUrl,
    role: { name: session.user.role.name, label: session.user.role.label },
    // Role permissions from the database, adjusted by this user's overrides (Super Admin: all).
    permissions: effectivePermissions(
      session.user.role.name,
      session.user.role.permissions.map((rp) => rp.permission.key),
      session.user.permissionOverrides.map((o) => ({ key: o.permission.key, granted: o.granted }))
    ),
  };
});
