-- Admin can open and edit the Permissions page by default (Super Admin already can).
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5(random()::text || clock_timestamp()::text || p."key"), r."id", p."id"
FROM "Role" r
JOIN "Permission" p ON p."key" IN ('permissions.view', 'permissions.edit')
WHERE r."name" = 'ADMIN'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
