import assert from "node:assert/strict";
import { can, canAny, ALL_PERMISSION_KEYS, RETAINED_DELETE_PERMISSIONS, requiresPatientAssignment, type PermissionKey } from "../src/lib/permissions";
import { validateFileContents } from "../src/lib/storage";
import { isOwnedStagingKey } from "../src/lib/r2";
const admin={permissions:[...ALL_PERMISSION_KEYS]};
for(const key of RETAINED_DELETE_PERMISSIONS) {
  assert.equal(can(admin,key as PermissionKey),false);
  assert.equal(canAny(admin,[key as PermissionKey]),false);
}
assert.equal(can(admin,"patients.delete"),true); // Patient deletion archives; no cascading deletion.
assert.equal(can({permissions:[]},"billing.refund"),false);
assert.equal(validateFileContents(Buffer.from('%PDF-1.7\nSynthetic'),'application/pdf','documents').ext,'pdf');
assert.throws(()=>validateFileContents(Buffer.from('<script>bad</script>'),'application/pdf','documents'));
assert.throws(()=>validateFileContents(Buffer.from('%PDF-1.7'),'image/png','documents'));
assert.throws(()=>validateFileContents(Buffer.from('%PDF-1.7'),'application/pdf','patients'));
assert.equal(isOwnedStagingKey('documents/staging/alice/'+'a'.repeat(32)+'.pdf','alice'),true);
assert.equal(isOwnedStagingKey('documents/staging/alice/'+'a'.repeat(32)+'.pdf','bob'),false);
assert.equal(isOwnedStagingKey('documents/staging/alice/../'+'a'.repeat(32)+'.pdf','alice'),false);
assert.equal(isOwnedStagingKey('documents/'+'a'.repeat(32)+'.pdf','alice'),false);
console.log('Retention overrides, permission denial, upload signatures and staging ownership checks passed.');

const roleActor = (name: string, permissions: string[] = []) => ({role: {name, label: name}, permissions});
assert.equal(requiresPatientAssignment(roleActor("CUSTOM_DOCTOR", ["patients.view"])), true);
assert.equal(requiresPatientAssignment(roleActor("CUSTOM_RECEPTION", ["patients.view", "patients.all"])), false);
assert.equal(requiresPatientAssignment(roleActor("DENTIST", ["patients.all"])), true);
assert.equal(requiresPatientAssignment(roleActor("RECEPTIONIST")), false);
assert.equal(requiresPatientAssignment(roleActor("ADMIN")), false);
assert.equal(can(roleActor("CUSTOM_RECEPTION", ["patients.all"]), "patients.view"), false);
console.log("Custom roles require assignment unless explicitly granted all-patient scope; module permissions remain independent.");
