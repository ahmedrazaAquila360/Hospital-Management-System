"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermission, requireUser } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { expenseSchema } from "@/lib/validations/expense";

export type ExpenseFormState = { error?: string; success?: boolean };

export async function createExpenseAction(_prev: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  const user = await requireUser();
  if (!can(user, "expenses.create")) return { error: "You don't have permission to do that." };

  const parsed = expenseSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please fix the highlighted fields." };
  const data = parsed.data;

  await prisma.expense.create({
    data: {
      title: data.title,
      category: data.category,
      amount: data.amount.toFixed(2),
      date: new Date(data.date),
      description: data.description || null,
      addedById: user.id,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "CREATE",
      entityType: "Expense",
      description: `${user.name} logged an expense: ${data.title} ($${data.amount.toFixed(2)}).`,
    },
  });

  revalidatePath("/expenses");
  return { success: true };
}

export async function deleteExpenseAction(id: string) {
  const user = await requireUser();
  assertPermission(user, "expenses.delete");
  const expense = await prisma.expense.delete({ where: { id } });
  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "DELETE",
      entityType: "Expense",
      entityId: id,
      description: `${user.name} deleted expense "${expense.title}".`,
    },
  });
  revalidatePath("/expenses");
}
