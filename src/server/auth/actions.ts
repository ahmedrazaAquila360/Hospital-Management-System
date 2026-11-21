"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getSessionUser } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validations/auth";
import { forgotPasswordSchema } from "@/lib/validations/forgot-password";

export type LoginActionState = {
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
};

export async function loginAction(_prev: LoginActionState, formData: FormData): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    remember: formData.get("remember") === "on",
  });

  if (!parsed.success) {
    const fieldErrors: LoginActionState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "email" || field === "password") fieldErrors[field] = issue.message;
    }
    return { fieldErrors };
  }

  const { email, password, remember } = parsed.data;

  // passwordHash is omitted globally (src/lib/prisma.ts); sign-in is one of two places that needs it.
  const user = await prisma.user.findUnique({ where: { email }, omit: { passwordHash: false } });
  if (!user) {
    return { error: "Invalid email or password." };
  }

  if (user.status !== "ACTIVE") {
    return { error: "This account has been deactivated. Contact an administrator." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { error: "Invalid email or password." };
  }

  await createSession(user.id, { rememberMe: remember });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "LOGIN",
      entityType: "User",
      entityId: user.id,
      description: `${user.name} signed in.`,
    },
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  const user = await getSessionUser();
  if (user) {
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "LOGOUT",
        entityType: "User",
        entityId: user.id,
        description: `${user.name} signed out.`,
      },
    });
  }
  await destroySession();
  redirect("/login");
}

export type ForgotPasswordState = { submitted?: boolean; error?: string };

export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({ email: String(formData.get("email") ?? "") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user) {
    // No transactional email provider is configured for this environment;
    // in production this would enqueue a reset-link email via that provider.
    console.info(`[forgot-password] reset requested for ${user.email}`);
  }

  // Always report success to avoid leaking which emails have accounts.
  return { submitted: true };
}
