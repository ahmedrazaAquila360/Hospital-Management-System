/**
 * Permission catalog: every action DentalHub can gate. Which roles and users hold which
 * permissions lives in the database (RolePermission / UserPermission) and is edited on the
 * Permissions page; the defaults below are only used by the seed script and "Reset to Default".
 */

export const SUPER_ADMIN = "SUPER_ADMIN";

export const BUILT_IN_ROLES = [
  { name: "SUPER_ADMIN", label: "Super Admin", description: "Full system access" },
  { name: "ADMIN", label: "Hospital Admin", description: "Manage hospital operations" },
  { name: "DENTIST", label: "Doctor", description: "Treatment and clinical access" },
  { name: "RECEPTIONIST", label: "Receptionist", description: "Patients, appointments and billing" },
  { name: "PHARMACIST", label: "Pharmacist", description: "Pharmacy stock and dispensing" },
  { name: "CASHIER", label: "Cashier", description: "Receive payments" },
  { name: "BILLING_OFFICER", label: "Billing Officer", description: "Hospital billing" },
  { name: "NURSE", label: "Nurse", description: "Admission support" },
  { name: "DEPARTMENT_MANAGER", label: "Department Manager", description: "Department operations" },
  { name: "INVENTORY_MANAGER", label: "Inventory Manager", description: "Stock receiving" },
  { name: "LAB_TECH", label: "Laboratory Technician", description: "Collect samples and enter results" },
  { name: "STAFF", label: "Staff", description: "Clinical support and basic access" },
] as const;

export type BuiltInRole = (typeof BUILT_IN_ROLES)[number]["name"];

/** The four matrix columns; "other" holds module-specific extra actions. */
export const STANDARD_ACTIONS = ["view", "create", "edit", "delete"] as const;
export type StandardAction = (typeof STANDARD_ACTIONS)[number];

type ActionDef = { action: string; label: string; description: string };

/** Modules, the actions each one supports, and what each action controls. */
export const PERMISSION_CATALOG = [
  { module: "attendance", label: "Attendance", actions: [
    { action: "view", label: "View own", description: "Read own shifts and check in or out." },
    { action: "manage", label: "Manage", description: "Schedule staff shifts and audit corrections." },
  ] },
  { module: "vitals", label: "Vital observations", actions: [
    { action: "view", label: "View", description: "View authorized encounter vital signs." },
    { action: "create", label: "Record", description: "Record timestamped vital observations and corrections." },
    { action: "review", label: "Review", description: "Append clinical review to vital observations." },
  ] },
  { module: "emergency", label: "Emergency", actions: [
    { action: "view", label: "View", description: "View assigned emergency cases." },
    { action: "create", label: "Register", description: "Register an emergency case for a patient." },
    { action: "edit", label: "Update", description: "Assign clinician, record approved triage and transfer." },
    { action: "manage", label: "Configure", description: "Configure draft triage categories." },
  ] },
  { module: "pharmacy", label: "Pharmacy", actions: [
    { action: "view", label: "View", description: "Read stock and pending prescriptions." },
    { action: "edit", label: "Dispense", description: "Dispense prescribed medicines and create charges." },
    { action: "manage", label: "Receive", description: "Manage medicine batches and stock receipts." },
  ] },
  { module: "ipd", label: "Admissions and beds", actions: [
    { action: "view", label: "View", description: "Read admissions and bed availability." },
    { action: "create", label: "Admit", description: "Admit a patient and allocate a bed." },
    { action: "edit", label: "Transfer", description: "Transfer patients and request discharge." },
    { action: "approve", label: "Discharge", description: "Sign a discharge summary." },
    { action: "manage", label: "Manage", description: "Configure beds and housekeeping status." },
  ] },
  { module: "lab", label: "Laboratory", actions: [
    { action: "view", label: "View", description: "Read the laboratory worklist." },
    { action: "create", label: "Order", description: "Order tests for assigned encounters." },
    { action: "edit", label: "Process", description: "Collect samples and enter results." },
    { action: "approve", label: "Approve", description: "Verify results and release reports." },
    { action: "manage", label: "Manage", description: "Configure the laboratory catalog." },
  ] },
  { module: "opd", label: "Outpatient consultations", actions: [
    { action: "view", label: "View", description: "Read assigned outpatient encounters." },
    { action: "edit", label: "Edit", description: "Document an assigned consultation." },
    { action: "manage", label: "Manage", description: "Access consultations across doctors." },
  ] },
  { module: "dashboard", label: "Dashboard", actions: [{ action: "view", label: "View", description: "Open the dashboard and its summary cards." }] },
  {
    module: "patients",
    label: "Patients",
    actions: [
      { action: "view", label: "View", description: "Patient list, profiles and patient search." },
      { action: "all", label: "All patients", description: "Allow a custom role to access patients across staff assignments. Module permissions are still required; Doctor roles remain assigned-only." },
      { action: "create", label: "Create", description: "Add new patients." },
      { action: "edit", label: "Edit", description: "Update patient details and medical history." },
      { action: "delete", label: "Delete", description: "Archive a patient and retain linked history." },
    ],
  },
  {
    module: "appointments",
    label: "Appointments",
    actions: [
      { action: "view", label: "View", description: "Calendar and appointment details." },
      { action: "create", label: "Create", description: "Book new appointments." },
      { action: "edit", label: "Edit", description: "Reschedule, check in, complete, cancel or mark no-show." },
      { action: "delete", label: "Delete", description: "Delete appointments." },
      { action: "requests", label: "Website Requests", description: "Review, confirm and decline online booking requests." },
    ],
  },
  {
    module: "dental_chart",
    label: "Dental Chart",
    actions: [
      { action: "view", label: "View", description: "Open patients' dental charts and history." },
      { action: "edit", label: "Edit", description: "Record tooth conditions on the chart." },
    ],
  },
  {
    module: "treatments",
    label: "Treatments",
    actions: [
      { action: "view", label: "View", description: "Treatment list and treatment details." },
      { action: "create", label: "Create", description: "Create treatment plans." },
      { action: "edit", label: "Edit", description: "Edit treatments and change their status." },
      { action: "delete", label: "Delete", description: "Delete treatments." },
    ],
  },
  {
    module: "prescriptions",
    label: "Prescriptions",
    actions: [
      { action: "view", label: "View", description: "Prescription list, details, print and PDF." },
      { action: "create", label: "Create", description: "Write new prescriptions." },
      { action: "delete", label: "Delete", description: "Delete prescriptions." },
    ],
  },
  {
    module: "billing",
    label: "Billing",
    actions: [
      { action: "view", label: "View", description: "Invoices, payments, invoice print and PDF." },
      { action: "guardian", label: "Revenue Guardian", description: "View and review branch revenue exceptions." },
      { action: "guardianManage", label: "Guardian configuration", description: "Scan and configure branch revenue exception rules." },
      { action: "create", label: "Create", description: "Create invoices." },
      { action: "refund", label: "Refund", description: "Post an auditable refund against a received payment." },
      { action: "discount", label: "Discount", description: "Authorize invoice discounts." },
      { action: "payments", label: "Record Payment", description: "Record full or partial payments on invoices." },
      { action: "shifts", label: "Cashier shifts", description: "Open, submit and view own cashier reconciliation." },
      { action: "shiftApprove", label: "Approve cashier close", description: "Review and approve submitted cashier reconciliation." },
      { action: "void", label: "Void invoice", description: "Void an unpaid manual invoice with a reason; retain its history." },
    ],
  },
  {
    module: "expenses",
    label: "Expenses",
    actions: [
      { action: "view", label: "View", description: "Expense list and totals." },
      { action: "create", label: "Create", description: "Add expenses." },
      { action: "delete", label: "Delete", description: "Delete expenses." },
    ],
  },
  { module: "reports", label: "Reports", actions: [{ action: "view", label: "View", description: "Reports, analytics and printable reports." }] },
  {
    module: "staff",
    label: "Staff",
    actions: [
      { action: "view", label: "View", description: "Staff list." },
      { action: "create", label: "Create", description: "Add staff accounts." },
      { action: "edit", label: "Edit", description: "Edit staff, change roles, activate or deactivate accounts." },
    ],
  },
  {
    module: "documents",
    label: "Documents",
    actions: [
      { action: "view", label: "View", description: "Document list, preview and download." },
      { action: "create", label: "Create", description: "Upload documents." },
      { action: "delete", label: "Delete", description: "Delete documents." },
    ],
  },
  { module: "notifications", label: "Notifications", actions: [{ action: "view", label: "View", description: "Notifications page and bell." }] },
  {
    module: "settings",
    label: "Settings",
    actions: [
      { action: "view", label: "View", description: "Settings page (own profile and password)." },
      { action: "edit", label: "Edit", description: "Clinic details, working hours and system settings." },
    ],
  },
  {
    module: "permissions",
    label: "Permissions",
    actions: [
      { action: "view", label: "View", description: "Open the Permissions page." },
      { action: "edit", label: "Edit", description: "Change role and user permissions and add roles." },
    ],
  },
] as const satisfies readonly { module: string; label: string; actions: readonly ActionDef[] }[];

type Catalog = typeof PERMISSION_CATALOG;
export type Module = Catalog[number]["module"];
export type PermissionKey = { [M in Catalog[number] as M["module"]]: `${M["module"]}.${M["actions"][number]["action"]}` }[Module];

export const MODULES = PERMISSION_CATALOG.map((m) => m.module) as Module[];
export const MODULE_LABELS = Object.fromEntries(PERMISSION_CATALOG.map((m) => [m.module, m.label])) as Record<Module, string>;

/** Flat list (key, module, label) — what the Permission table holds. */
export const PERMISSIONS = PERMISSION_CATALOG.flatMap((m) =>
  m.actions.map((a) => ({ key: `${m.module}.${a.action}` as PermissionKey, module: m.module as Module, label: `${a.label} ${m.label}` }))
);

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSIONS.map((p) => p.key);

const all = (module: Module) => PERMISSIONS.filter((p) => p.module === module).map((p) => p.key);
const keys = (...k: PermissionKey[]) => k;

/** Default matrix for the built-in roles (seed and "Reset to Default" only). */
export const DEFAULT_ROLE_PERMISSIONS: Record<BuiltInRole, PermissionKey[]> = {
  SUPER_ADMIN: ALL_PERMISSION_KEYS,
  // Admin can also manage permissions; only the Super Admin role and accounts stay off-limits
  // (enforced in the permission and staff actions).
  ADMIN: ALL_PERMISSION_KEYS,
  DENTIST: [
    ...keys("attendance.view"),
    ...all("vitals"),
    ...keys("emergency.view", "emergency.edit"),
    ...keys("opd.view", "opd.edit", "lab.create"),
    ...all("dashboard"),
    ...keys("patients.view", "patients.create", "patients.edit"),
    ...keys("appointments.view", "appointments.create", "appointments.edit", "appointments.delete", "appointments.requests"),
    ...all("dental_chart"),
    ...all("treatments"),
    ...all("prescriptions"),
    ...all("documents"),
    ...keys("notifications.view", "settings.view"),
  ],
  RECEPTIONIST: [
    ...keys("attendance.view"),
    ...keys("emergency.view", "emergency.create"),
    ...all("dashboard"),
    ...keys("patients.view", "patients.create", "patients.edit"),
    ...keys("appointments.view", "appointments.create", "appointments.edit", "appointments.delete", "appointments.requests"),
    ...keys("billing.view","billing.create","billing.payments"),
    ...all("documents"),
    ...keys("notifications.view", "settings.view"),
  ],
  PHARMACIST: [...all("pharmacy"), ...keys("attendance.view")],
  CASHIER: keys("attendance.view","billing.view", "billing.payments", "billing.guardian", "billing.shifts"),
  BILLING_OFFICER: [...all("billing"), ...keys("attendance.view")],
  NURSE: keys("attendance.view","ipd.view","ipd.edit","emergency.view","emergency.edit","vitals.view","vitals.create"),
  DEPARTMENT_MANAGER: keys("attendance.view","settings.view"),
  INVENTORY_MANAGER: keys("attendance.view","pharmacy.view","pharmacy.manage"),
  LAB_TECH: keys("attendance.view","lab.view", "lab.edit", "notifications.view", "settings.view"),
  STAFF: [...keys("attendance.view","dashboard.view", "patients.view", "appointments.view", "notifications.view", "settings.view"), ...all("documents")],
};

export function isBuiltInRole(name: string): name is BuiltInRole {
  return BUILT_IN_ROLES.some((r) => r.name === name);
}

export type SessionUser = {
  activeBranchId?: string;
  branches?: {id: string; name: string}[];
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: {
    name: string;
    label: string;
  };
  permissions: string[];
};

// Clinical and financial records are retained even for administrators.
export const RETAINED_DELETE_PERMISSIONS = new Set<string>([
  "appointments.delete", "prescriptions.delete", "treatments.delete", "documents.delete", "expenses.delete",
]);

export function can(user: Pick<SessionUser, "permissions"> | null | undefined, key: PermissionKey): boolean {
  if (!user) return false;
  return !RETAINED_DELETE_PERMISSIONS.has(key) && user.permissions.includes(key);
}

export function canAny(user: Pick<SessionUser, "permissions"> | null | undefined, keys: PermissionKey[]): boolean {
  if (!user) return false;
  return keys.some((key) => can(user, key));
}

/**
 * Effective permissions: Super Admin always has everything; everyone else gets their role's
 * permissions plus per-user grants, minus per-user revokes.
 */
export function effectivePermissions(roleName: string, roleKeys: string[], overrides: { key: string; granted: boolean }[]): string[] {
  if (roleName === SUPER_ADMIN) return [...ALL_PERMISSION_KEYS];
  const set = new Set(roleKeys);
  for (const o of overrides) {
    if (o.granted) set.add(o.key);
    else set.delete(o.key);
  }
  return [...set];
}

/** Custom roles fail closed unless explicitly granted cross-assignment access. */
export function requiresPatientAssignment(user: Pick<SessionUser, "role" | "permissions">): boolean {
  return user.role.name === "DENTIST" || (!isBuiltInRole(user.role.name) && !can(user, "patients.all"));
}
