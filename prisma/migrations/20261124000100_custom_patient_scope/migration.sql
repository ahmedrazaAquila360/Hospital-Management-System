-- Explicit cross-assignment access for custom roles; no existing role is granted it.
INSERT INTO "Permission" ("id", "key", "label", "module")
VALUES ('hospital_patients_all', 'patients.all', 'All patients', 'patients')
ON CONFLICT ("key") DO NOTHING;
