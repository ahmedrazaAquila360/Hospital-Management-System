import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().optional(),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const clinicSettingsSchema = z.object({
  clinicName: z.string().min(2, "Clinic name is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.union([z.email(), z.literal("")]).optional(),
  website: z.string().optional(),
});

export const systemSettingsSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  dateFormat: z.string().min(1),
  timeZone: z.string().refine(zone => { try { new Intl.DateTimeFormat("en",{ timeZone:zone }).format(); return Boolean(zone); } catch { return false; } }, "Choose a valid timezone"),
});
