import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { can, type PermissionKey, type SessionUser } from "@/lib/permissions";

/**
 * Redirects to /login if there's no valid session. Use in server components/layouts.
 * The proxy already sent cookie-less visitors to /login, so reaching here means the cookie is
 * stale (expired or deleted session); `session=expired` tells the proxy to clear it instead of
 * bouncing back to /dashboard, which looped forever.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login?session=expired");
  return user;
}

/**
 * Redirects to /login (no session) or to a "no access" page naming the missing permission
 * (it used to bounce silently to /dashboard, which looked like a broken link).
 */
export async function requirePermission(key: PermissionKey): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, key)) redirect(`/no-access?permission=${encodeURIComponent(key)}`);
  return user;
}

/**
 * For server actions: throws when the signed-in user lacks `key`. Pages hide controls the user
 * can't use, but actions can be called directly, so every write checks here as well.
 */
export function assertPermission(user: SessionUser, key: PermissionKey) {
  if (!can(user, key)) throw new Error("You don't have permission to do that.");
}
