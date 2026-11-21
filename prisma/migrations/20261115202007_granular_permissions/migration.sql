-- CreateTable
CREATE TABLE "UserPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPermission_userId_idx" ON "UserPermission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermission_userId_permissionId_key" ON "UserPermission"("userId", "permissionId");

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data: granular permission catalog (keeps every role's current access).

INSERT INTO "Permission" ("id", "key", "label", "module") VALUES
  (md5(random()::text || clock_timestamp()::text), 'dashboard.view', 'View Dashboard', 'dashboard'),
  (md5(random()::text || clock_timestamp()::text), 'patients.view', 'View Patients', 'patients'),
  (md5(random()::text || clock_timestamp()::text), 'patients.create', 'Create Patients', 'patients'),
  (md5(random()::text || clock_timestamp()::text), 'patients.edit', 'Edit Patients', 'patients'),
  (md5(random()::text || clock_timestamp()::text), 'patients.delete', 'Delete Patients', 'patients'),
  (md5(random()::text || clock_timestamp()::text), 'appointments.view', 'View Appointments', 'appointments'),
  (md5(random()::text || clock_timestamp()::text), 'appointments.create', 'Create Appointments', 'appointments'),
  (md5(random()::text || clock_timestamp()::text), 'appointments.edit', 'Edit Appointments', 'appointments'),
  (md5(random()::text || clock_timestamp()::text), 'appointments.delete', 'Delete Appointments', 'appointments'),
  (md5(random()::text || clock_timestamp()::text), 'appointments.requests', 'Website Requests Appointments', 'appointments'),
  (md5(random()::text || clock_timestamp()::text), 'dental_chart.view', 'View Dental Chart', 'dental_chart'),
  (md5(random()::text || clock_timestamp()::text), 'dental_chart.edit', 'Edit Dental Chart', 'dental_chart'),
  (md5(random()::text || clock_timestamp()::text), 'treatments.view', 'View Treatments', 'treatments'),
  (md5(random()::text || clock_timestamp()::text), 'treatments.create', 'Create Treatments', 'treatments'),
  (md5(random()::text || clock_timestamp()::text), 'treatments.edit', 'Edit Treatments', 'treatments'),
  (md5(random()::text || clock_timestamp()::text), 'treatments.delete', 'Delete Treatments', 'treatments'),
  (md5(random()::text || clock_timestamp()::text), 'prescriptions.view', 'View Prescriptions', 'prescriptions'),
  (md5(random()::text || clock_timestamp()::text), 'prescriptions.create', 'Create Prescriptions', 'prescriptions'),
  (md5(random()::text || clock_timestamp()::text), 'prescriptions.delete', 'Delete Prescriptions', 'prescriptions'),
  (md5(random()::text || clock_timestamp()::text), 'billing.view', 'View Billing', 'billing'),
  (md5(random()::text || clock_timestamp()::text), 'billing.create', 'Create Billing', 'billing'),
  (md5(random()::text || clock_timestamp()::text), 'billing.payments', 'Record Payment Billing', 'billing'),
  (md5(random()::text || clock_timestamp()::text), 'expenses.view', 'View Expenses', 'expenses'),
  (md5(random()::text || clock_timestamp()::text), 'expenses.create', 'Create Expenses', 'expenses'),
  (md5(random()::text || clock_timestamp()::text), 'expenses.delete', 'Delete Expenses', 'expenses'),
  (md5(random()::text || clock_timestamp()::text), 'reports.view', 'View Reports', 'reports'),
  (md5(random()::text || clock_timestamp()::text), 'staff.view', 'View Staff', 'staff'),
  (md5(random()::text || clock_timestamp()::text), 'staff.create', 'Create Staff', 'staff'),
  (md5(random()::text || clock_timestamp()::text), 'staff.edit', 'Edit Staff', 'staff'),
  (md5(random()::text || clock_timestamp()::text), 'documents.view', 'View Documents', 'documents'),
  (md5(random()::text || clock_timestamp()::text), 'documents.create', 'Create Documents', 'documents'),
  (md5(random()::text || clock_timestamp()::text), 'documents.delete', 'Delete Documents', 'documents'),
  (md5(random()::text || clock_timestamp()::text), 'notifications.view', 'View Notifications', 'notifications'),
  (md5(random()::text || clock_timestamp()::text), 'settings.view', 'View Settings', 'settings'),
  (md5(random()::text || clock_timestamp()::text), 'settings.edit', 'Edit Settings', 'settings'),
  (md5(random()::text || clock_timestamp()::text), 'permissions.view', 'View Permissions', 'permissions'),
  (md5(random()::text || clock_timestamp()::text), 'permissions.edit', 'Edit Permissions', 'permissions')
ON CONFLICT ("key") DO UPDATE SET "label" = EXCLUDED."label", "module" = EXCLUDED."module";

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5(random()::text || clock_timestamp()::text), rp."roleId", np."id" FROM "RolePermission" rp
JOIN "Permission" op ON op."id" = rp."permissionId" AND op."key" = 'patients.manage'
JOIN "Permission" np ON np."key" IN ('patients.create', 'patients.edit')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5(random()::text || clock_timestamp()::text), rp."roleId", np."id" FROM "RolePermission" rp
JOIN "Permission" op ON op."id" = rp."permissionId" AND op."key" = 'appointments.manage'
JOIN "Permission" np ON np."key" IN ('appointments.create', 'appointments.edit', 'appointments.delete', 'appointments.requests')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5(random()::text || clock_timestamp()::text), rp."roleId", np."id" FROM "RolePermission" rp
JOIN "Permission" op ON op."id" = rp."permissionId" AND op."key" = 'dental_chart.manage'
JOIN "Permission" np ON np."key" IN ('dental_chart.edit')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5(random()::text || clock_timestamp()::text), rp."roleId", np."id" FROM "RolePermission" rp
JOIN "Permission" op ON op."id" = rp."permissionId" AND op."key" = 'treatments.manage'
JOIN "Permission" np ON np."key" IN ('treatments.create', 'treatments.edit', 'treatments.delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5(random()::text || clock_timestamp()::text), rp."roleId", np."id" FROM "RolePermission" rp
JOIN "Permission" op ON op."id" = rp."permissionId" AND op."key" = 'prescriptions.manage'
JOIN "Permission" np ON np."key" IN ('prescriptions.create', 'prescriptions.delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5(random()::text || clock_timestamp()::text), rp."roleId", np."id" FROM "RolePermission" rp
JOIN "Permission" op ON op."id" = rp."permissionId" AND op."key" = 'billing.manage'
JOIN "Permission" np ON np."key" IN ('billing.create', 'billing.payments')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5(random()::text || clock_timestamp()::text), rp."roleId", np."id" FROM "RolePermission" rp
JOIN "Permission" op ON op."id" = rp."permissionId" AND op."key" = 'expenses.manage'
JOIN "Permission" np ON np."key" IN ('expenses.create', 'expenses.delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5(random()::text || clock_timestamp()::text), rp."roleId", np."id" FROM "RolePermission" rp
JOIN "Permission" op ON op."id" = rp."permissionId" AND op."key" = 'staff.manage'
JOIN "Permission" np ON np."key" IN ('staff.create', 'staff.edit')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5(random()::text || clock_timestamp()::text), rp."roleId", np."id" FROM "RolePermission" rp
JOIN "Permission" op ON op."id" = rp."permissionId" AND op."key" = 'documents.manage'
JOIN "Permission" np ON np."key" IN ('documents.create', 'documents.delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5(random()::text || clock_timestamp()::text), rp."roleId", np."id" FROM "RolePermission" rp
JOIN "Permission" op ON op."id" = rp."permissionId" AND op."key" = 'settings.manage'
JOIN "Permission" np ON np."key" IN ('settings.edit')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Deleting a patient used to be limited to Admin / Super Admin in code; keep that.

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5(random()::text || clock_timestamp()::text), r."id", p."id" FROM "Role" r JOIN "Permission" p ON p."key" = 'patients.delete'
WHERE r."name" IN ('SUPER_ADMIN', 'ADMIN')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- The Permissions page itself: Super Admin only by default.

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5(random()::text || clock_timestamp()::text), r."id", p."id" FROM "Role" r JOIN "Permission" p ON p."key" IN ('permissions.view', 'permissions.edit')
WHERE r."name" = 'SUPER_ADMIN'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Drop the old coarse "*.manage" (and any other retired) permissions; role links cascade.

DELETE FROM "Permission" WHERE "key" NOT IN ('dashboard.view', 'patients.view', 'patients.create', 'patients.edit', 'patients.delete', 'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.delete', 'appointments.requests', 'dental_chart.view', 'dental_chart.edit', 'treatments.view', 'treatments.create', 'treatments.edit', 'treatments.delete', 'prescriptions.view', 'prescriptions.create', 'prescriptions.delete', 'billing.view', 'billing.create', 'billing.payments', 'expenses.view', 'expenses.create', 'expenses.delete', 'reports.view', 'staff.view', 'staff.create', 'staff.edit', 'documents.view', 'documents.create', 'documents.delete', 'notifications.view', 'settings.view', 'settings.edit', 'permissions.view', 'permissions.edit');
