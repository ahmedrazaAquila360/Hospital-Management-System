import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  "RENT",
  "UTILITIES",
  "SALARIES",
  "EQUIPMENT",
  "SUPPLIES",
  "MAINTENANCE",
  "MARKETING",
  "OTHER",
] as const;

export const expenseSchema = z.object({
  title: z.string().min(2, "Title is required"),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  date: z.string().min(1, "Date is required"),
  description: z.string().optional(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
