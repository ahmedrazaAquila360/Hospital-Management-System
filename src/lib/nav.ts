import type { LucideIcon } from "lucide-react";
import {
  ShieldCheck,
  ShieldUser,
  LayoutDashboard,
  Users,
  CalendarDays,
  Grid3x3,
  Stethoscope,
  Pill,
  Receipt,
  Wallet,
  BarChart3,
  UserCog,
  FolderOpen,
  Bell,
  Settings,
  UserPlus,
  FileText,
  CreditCard,
} from "lucide-react";
import type { PermissionKey } from "@/lib/permissions";

export type NavChild = { title: string; href: string; icon: LucideIcon; permission?: PermissionKey };

export type NavItem = {
  title: string;
  /** For a group, a key only (the group opens; its children are the links). */
  href: string;
  icon: LucideIcon;
  /** Omit for a group whose visibility comes from its children's permissions. */
  permission?: PermissionKey;
  children?: NavChild[];
};

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
  {
    // Admin tools grouped right after Dashboard; hidden when the user can see neither.
    title: "Administration",
    href: "#administration",
    icon: ShieldUser,
    children: [
      { title: "Doctors", href: "/doctors", icon: Stethoscope, permission: "staff.edit" },
      { title: "Branches", href: "/branches", icon: Stethoscope, permission: "permissions.edit" },
      { title: "Departments", href: "/departments", icon: Stethoscope, permission: "settings.edit" },
      { title: "Staff", href: "/staff", icon: UserCog, permission: "staff.view" },
      { title: "Permissions", href: "/permissions", icon: ShieldCheck, permission: "permissions.view" },
    ],
  },
  {
    title: "Patients",
    href: "/patients",
    icon: Users,
    permission: "patients.view",
    children: [
      { title: "All Patients", href: "/patients", icon: Users },
      { title: "Add Patient", href: "/patients/new", icon: UserPlus },
    ],
  },
  { title: "Appointments", href: "/appointments", icon: CalendarDays, permission: "appointments.view" },
  { title: "Pharmacy", href: "/pharmacy", icon: Pill, permission: "pharmacy.view" },
  { title: "Laboratory", href: "/laboratory", icon: Stethoscope, permission: "lab.view" },
  { title: "Admissions and beds", href: "/admissions", icon: Stethoscope, permission: "ipd.view" },
  { title: "OPD", href: "/opd", icon: Stethoscope, permission: "opd.view" },
  { title: "Dental Chart", href: "/dental-chart", icon: Grid3x3, permission: "dental_chart.view" },
  { title: "Treatments", href: "/treatments", icon: Stethoscope, permission: "treatments.view" },
  { title: "Prescriptions", href: "/prescriptions", icon: Pill, permission: "prescriptions.view" },
  {
    title: "Billing",
    href: "/billing/invoices",
    icon: Receipt,
    permission: "billing.view",
    children: [
      { title: "Invoices", href: "/billing/invoices", icon: FileText },
      { title: "Payments", href: "/billing/payments", icon: CreditCard },
    ],
  },
  { title: "Expenses", href: "/expenses", icon: Wallet, permission: "expenses.view" },
  { title: "Reports", href: "/reports", icon: BarChart3, permission: "reports.view" },
  { title: "Documents", href: "/documents", icon: FolderOpen, permission: "documents.view" },
  { title: "Notifications", href: "/notifications", icon: Bell, permission: "notifications.view" },
  { title: "Settings", href: "/settings", icon: Settings, permission: "settings.view" },
];
