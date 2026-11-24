# Security, record retention and appointment regression review

Reviewed November 24, 2026. Scope: the single-hospital MVP application, inherited clinical/document routes and appointment transaction services. This is an implementation review and regression pass, not an independent penetration test or a compliance certification.

## Changes

- Central permission checks deny hard deletion of appointments, prescriptions, treatments, documents and expenses, including for administrators. Patient deletion continues to archive. Existing clinical amendments, appointment cancellation and financial refund records preserve history. This is application-level retention; privileged database access remains outside these guards.
- Completed treatments cannot be overwritten or reopened, and treatment patient identity cannot be changed. Appointments with an encounter cannot be moved or rewritten through the scheduling form; terminal appointments cannot be reopened. Clinical corrections use the existing clinical amendment workflow.
- Doctor document access requires an assigned patient. Patient photographs use the same assignment predicate. Document, prescription and treatment summaries are scoped rather than exposing hospital-wide counts to doctors.
- Billing queries select patient contact/identity fields instead of loading clinical history. Patient lists omit invoice relations without billing access. Appointment detail relations respect treatment and prescription permissions.
- Staff account creation/editing requires permission-administration access to assign roles. Password changes invalidate all sessions in the same database transaction. Existing session checks reject expired sessions and inactive accounts.
- R2 uploads use user-owned staging keys. Finalization checks size and file signatures, copies validated bytes to a new final key and removes the staging object. A reusable signed upload URL cannot overwrite the finalized record. Legacy public document links now require private-storage migration instead of redirecting to an unprotected URL.
- Scheduling uses ordered doctor advisory locks plus the existing database overlap constraint. Edits use conditional writes to reject intervening status/time changes. Audit records are transactional. Check-in and completion retries retain one encounter and one consultation bill.
- Scheduling parses local times in the configured hospital timezone, validates calendar dates, rejects nonexistent DST times and uses the hospital clock in the calendar and edit/detail forms.

## Repeatable checks

Use the dedicated synthetic development database, never the original DentalHub database:

```sh
NODE_OPTIONS='--conditions=react-server' pnpm exec tsx tests/security-policy.test.ts
RUN_HOSPITAL_TRANSACTION_TESTS=1 NODE_OPTIONS='--conditions=react-server' pnpm exec tsx tests/appointment-regression.test.ts
pnpm run build
```

The policy suite checks admin-inclusive retention denial, ordinary permission denial, upload signatures and staging ownership/traversal rejection.

The appointment suite exercises actual database services: invalid dates/times/durations, doctor hours, eight competing bookings, adjacent slots, conflicting and successful rescheduling, no-show reopening, cancellation, concurrent check-in/completion, one encounter and consultation invoice, checked-in/terminal edit protection, walk-ins, unrelated-patient denial and rollback after a deliberately invalid audit actor. It also verifies Karachi local time conversion and a New York DST gap. Fixtures are removed afterward. Expected database errors from deliberately failing transactions appear in the test log.

## Deployment and remaining limits

No schema migration is needed for this increment. Rebuild the application. Privately migrate any legacy public documents before restoring their access; no automatic migration or deletion of external files was performed. Review existing appointment instants if the previous server timezone differed from the configured hospital timezone; this change does not rewrite history. Ambiguous fall-back times follow PostgreSQL's timezone interpretation. Ancillary historical activity timestamps still use the existing generic formatter.

R2's live upload/download integration needs verification with the deployment's private bucket and CORS configuration; this pass tests the validation/ownership policy locally. Signature validation is not malware scanning. Use deployment-level login throttling and verify private storage access controls before a clinical pilot. Full branch/tenant isolation and custom-role clinical assignment rules remain separate work: current doctor assignment restrictions use the built-in Doctor role. Document/expense voiding workflows are not added; hard deletion is disabled. This review does not establish full ERP or clinical-pilot readiness.

## Verification result

Policy tests, appointment database regressions, targeted ESLint, TypeScript validation through the production build, the final production build and `git diff --check` passed. Browser checks against that production build confirmed anonymous patient access redirects to login; cashier access to patients, OPD, laboratory, admissions and documents redirects to the permission-denied page; an authenticated in-browser document fetch returns 403; and admin appointment list/new pages load while retained-record lists expose no delete buttons. Browser checks are smoke coverage, not exhaustive tests of every role/action combination. Previously completed payment, refund, pharmacy and inpatient contention suites were not rerun because their services did not change.

## Custom-role patient access follow-up — November 24, 2026

Custom roles now default to the same assignment predicate used by doctors on patient profiles/search, documents/downloads/photos, prescriptions, treatments and appointment reads/writes. Dashboard patient/appointment lists and discharge-print restrictions also use the shared predicate. A custom role can no longer bypass these checks merely because its name differs from `DENTIST`.

The existing Permissions matrix exposes **Patients → All patients** (`patients.all`) for administrators to explicitly grant cross-assignment access to custom roles. It does not grant module view/edit permissions. Built-in Doctor accounts remain restricted even if granted this key. Other built-in operational roles retain their existing behavior. Existing custom roles receive no automatic grant; review custom receptionist/administrative roles after deployment. Copying an unrestricted role can copy this explicit permission. Revoking it takes effect on the next request through existing session permission loading.

Deploy `20261124000100_custom_patient_scope` before using the permission editor. This additive migration inserts only a permission catalog row and does not modify patient records or grant existing roles broader access. It was applied only to the dedicated hospital development database.

The policy suite now checks default restriction, explicit grant, built-in Doctor protection and independence from module permissions. The appointment database suite verifies assigned/unassigned patient queries for custom roles, denial of unrelated-patient registration and appointment status mutations, and explicit broad access. The complete appointment suite, lint and production build passed.

Boundary: laboratory, pharmacy and inpatient operational worklists still use their dedicated module permissions; this increment does not convert those permissions to assignment-only access. Dashboard aggregate statistics remain hospital-wide for dashboard viewers. The doctor scheduling catalog still requires the built-in Doctor role. Branch isolation, department-based assignment and live R2 validation remain outstanding.
