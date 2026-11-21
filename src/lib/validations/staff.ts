import { z } from "zod";

export const staffSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.email("Enter a valid email"),
  phone: z.string().optional(),
  // Any role defined on the Permissions page; the action checks it exists.
  role: z.string().trim().min(1, "Select a role"),
  joiningDate: z.string().optional(),
});

export type StaffInput = z.infer<typeof staffSchema>;

export const createStaffSchema = staffSchema.extend({
  password: z.string().min(8, "Password must be at least 8 characters"),
});
