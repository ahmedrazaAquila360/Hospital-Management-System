# Hospital MVP implementation record

The baseline is the six-page DentalHub feature inventory dated November 20, 2026, checked against the App Router routes, server actions, permission catalog and PostgreSQL schema. This repository uses the existing staff shell and shared components. The local hospital database starts from the existing migration chain and has its own database URL and session cookie.

## Feature mapping

| Existing inventory | Hospital implementation | Remaining acceptance work |
|---|---|---|
| Public website and booking requests | Existing public pages and reception review | Outside the redesign scope |
| Login, staff, custom roles, user overrides | Database sessions, hospital role defaults and dedicated lab, OPD, IPD and pharmacy action permissions | Verify object access on every inherited route and download |
| Dashboard and reports | Existing revenue, balance, calendar and registration queries plus OPD, census and bed counts | Emergency census, departmental date filters, activity feed and service revenue totals implemented. Reporting and dashboard date boundaries now use the hospital timezone; calendar and PostgreSQL daylight-saving regression checks passed. |
| Patients and medical history | Central Patient ID, sequence-issued MRN, demographic duplicate check, insurance and surgical history, connected visit and admission tabs | Serialized duplicate detection and patient archiving implemented. Retention review for other inherited delete paths remains. |
| Calendar and booking | Existing day/week/month views, staff schedules, department snapshot and database overlap exclusion | Walk-in shortcut, full concurrency and timezone regression suite |
| Dental chart and treatment | Historical dental tables and procedure prices retained. Encounter and append-only ClinicalNote handle outpatient documentation | Inpatient notes, signed amendment chains and the combined patient clinical timeline are implemented. Amendment browser regression passed; original notes remain preserved. |
| Prescriptions | Existing multi-line prescription, appointment association, print and PDF. OPD opens contextual prescription creation | Route and catalog suggestions implemented. Recorded-allergy acknowledgement requires clinician review. Verified interaction data integration remains. |
| Invoices, expenses and payments | Existing billing, printed invoices, expenses and reports. Payment posting locks the invoice. Completed consultations with configured fees, released tests and dispenses create invoices | Refunds, authorized discounts, deposits and bed charge settlement implemented. Concurrent payment retry and overpayment regression passed; Concurrent refund and mixed payment/refund checks also passed; deposit/discharge contention checks passed. |
| Files and notifications | Private local clinical uploads, session-checked downloads, private R2 configuration, existing notification bell, lab release event | Review older file grants, remote upload validation and configurable delivery |
| Hospital settings, departments, doctors | Registration details, department directory and assignments, doctor account profiles, weekly hours and consultation pricing | Service catalog and optional Branch relationships implemented. Branch-level access enforcement remains. |
| Laboratory | Catalog, prices and reference text, sample tracking, result entry, separate verifier, release and patient history | Printable released report implemented. Range-specific numeric interpretation remains. |
| Pharmacy | Medication and batch records, receiving, expiry/quantity guard, audited dispensing, invoice linkage | Returns, audited adjustments and expiry indicators implemented. Partial fills and scheduled expiry notifications remain. |
| Admissions and beds | Ward/room/bed identifiers, bed board, transfers, discharge request, signed summary and housekeeping | Inpatient clinical workspace, orders, deposits, bed tariffs and discharge invoice implemented. Reservation cancellation/confirmation and deposit settlement browser checks passed. Admission, transfer, discharge and deposit transaction contention checks passed. |

## Relationships and consistency

Patient remains the identity used by appointments, prescriptions, admissions and billing. User remains the staff account. The historical DENTIST role key identifies doctor accounts and keeps existing selectors compatible. DoctorProfile holds the clinical account's credentials, specialty, fee and weekly schedule. Department is referenced by staff, appointments and admissions.

An appointment has at most one encounter. Check-in creates the encounter, issues a sequence token and logs the status change in one transaction. Notes are appended with author and timestamp. Laboratory orders retain the price and reference text from ordering time. Verification requires a different person from the result author. A released result appears on the encounter and patient record.

PharmacyBatch holds quantity and expiry for a medication lot. Dispensing checks the selected medication, expiry and available quantity at the database write, then creates the invoice and fill together. Each prescription line supports one fill. Admission changes acquire a row lock and update the admission, beds and audit trail together. Partial unique indexes restrict active occupancy to one admission per patient and bed.

## Permission matrix

The definitive list of permission keys, defaults and per-user overrides is in src/lib/permissions.ts. The following describes the initial hospital roles.

| Role | Default hospital access |
|---|---|
| Super Admin / Hospital Admin | All hospital modules. Super Admin retains all catalog permissions. |
| Doctor | Assigned OPD queue, notes and test ordering, with inherited clinical permissions |
| Receptionist | Registration, appointment management, check-in and existing reception billing |
| Nurse | Inpatient register, transfer and discharge request |
| Laboratory Technician | Worklist, collection, processing and result entry |
| Pharmacist | Prescription verification, stock receipt and dispensing |
| Cashier | Invoices and payment collection |
| Billing Officer | Invoice creation and payment collection |
| Department Manager | Settings access pending departmental scoping |
| Inventory Manager | Pharmacy stock and receiving |

Grant lab.approve to a verifier through Permissions. Grant ipd.approve to staff authorized to complete discharges. Site-specific custom roles use the existing matrix.

## Deployment and acceptance

1. Configure HOSPITAL_DATABASE_URL for a dedicated PostgreSQL database. The appointment constraint requires btree_gist. Existing overlapping appointments must be reconciled before applying that migration to an existing hospital database.
2. Run pnpm exec prisma generate and pnpm exec prisma migrate deploy. Configure a persistent HOSPITAL_UPLOAD_DIR for private local uploads, or hospital-specific R2 credentials for document storage. Patient photos require the private disk.
3. For local development, set HOSPITAL_DEMO_PASSWORD and run pnpm exec prisma db seed. The seed creates synthetic staff accounts and General Medicine. It preserves existing passwords and role grants.
4. Before a clinical pilot, complete the outstanding acceptance work above and run the five requested workflows with separate reception, clinician, technician, verifier, pharmacy and cashier accounts. Include simultaneous admission, dispensing and payment attempts and denied cross-patient reads in regression coverage.


## Verification recorded in this implementation

The production build, TypeScript check and lint of changed source files passed. Browser checks using synthetic records passed for patient registration, appointment booking, check-in, consultation notes, prescription creation, laboratory processing and release by a separate user, admission and discharge, pharmacy dispensing, payment, partial stock return, refund and printable laboratory report. The stock check confirmed 20 units became 18 after dispensing two, then 19 after returning one. Net payment after the refund matched the reduced invoice total. Cashier attempts to open OPD, laboratory, patients and admissions reached permission-denied pages.

Admission reservation, deposit settlement and signed amendment browser checks have passed. The inpatient, payment/refund and pharmacy transaction contention suites described below have passed. The current implementation remains a development MVP pending the outstanding items in the feature mapping.

Local development uses database hospital_management_mvp. Staff login credentials use HOSPITAL_DEMO_PASSWORD in the local .env file. The seed uses synthetic accounts only. The retained DENTIST database role is displayed as Doctor.

Bed charging uses hospital calendar nights, with one day charged for an admission and discharge on the same calendar day. A transfer retains each bed's rate at allocation time. This billing convention is an implementation assumption for hospital review.

Discharge report verification passed through the browser. An authorized administrator opened a completed synthetic admission's printable summary and saw the saved discharge instructions. An anonymous request to the same report redirected to login. The admission register now links completed admissions to this report. TypeScript and targeted lint checks passed.

## Admission and patient-profile follow-up — November 22, 2026

Active admissions can collect additional deposits, including after confirming a reservation. Collection requires both inpatient visibility and payment permission. The action locks the admission before the invoice, checks the submitted previous total to reject stale/repeated submissions, records the payment and audit event, and reuses the admission invoice at discharge. Monetary arithmetic uses Decimal. No schema migration is required for this increment.

Browser and database checks confirmed reservation cancellation releases the bed, confirmation creates an occupied bed and encounter, a 50 deposit remains on a 125 discharge invoice with 75 outstanding, and invoice items sum to the final total. Replaying the deposit submission created no second payment. Discharge changed the bed to cleaning. Signing an amendment retained the original note and created a linked correction with its reason.

Patient profiles now include a chronological inpatient/outpatient clinical timeline and released laboratory results from both encounter types. Related appointments, prescriptions, procedures, documents and invoices are loaded only with their module permission. The balance card also requires billing permission. Document download assignment checks reuse the patient access rule.

Verification for this increment: production build, TypeScript and targeted ESLint passed. Browser checks confirmed the combined timeline displays original and amended inpatient notes, and a doctor without billing permission sees neither the billing tab nor the outstanding balance card.

## Reporting timezone follow-up — November 22, 2026

Reports convert hospital calendar ranges to UTC timestamp boundaries, including daylight-saving transitions, and use an exclusive end boundary. Appointments and manually dated expenses retain their calendar-date semantics. Expense monthly summaries use the hospital calendar month. Dashboard payment/patient monthly buckets, selected-month registrations, seven-day appointment counts and upcoming dates no longer depend on the application host timezone. The seven-day chart excludes future appointments rather than folding matching weekday names into past buckets. Invalid or reversed custom ranges fall back to the hospital's current day.

Repeatable checks:
- `pnpm exec tsx tests/report-calendar.test.ts` covers year boundaries, leap dates and invalid/custom ranges. It also passes under Los Angeles and Tokyo host timezones.
- `NODE_OPTIONS='--conditions=react-server' pnpm exec tsx tests/report-calendar-db.test.ts` reads the dedicated hospital database to verify Karachi UTC boundaries and New York 23/25-hour days. It does not write records.

Targeted ESLint and TypeScript passed. Browser smoke checks loaded today/custom reports, the invalid-range fallback, and the dashboard successfully.

## Payment retry and contention follow-up — November 22, 2026

The payment dialog now issues a unique submission ID when opened and retains it for retries. The server still authorizes payment collection, validates the request, and locks the invoice. Repeating the same submission returns success without duplicating the payment, notification or audit entry. Reusing an ID with changed payment details is rejected. Balance arithmetic uses Decimal. A nullable compound unique key on invoice/submission preserves historical payments, deposits and refunds.

Deploy migration `20261122000100_payment_retries` before running this version (`pnpm exec prisma migrate deploy`, then rebuild). The original DentalHub database is not involved.

`RUN_HOSPITAL_TRANSACTION_TESTS=1 NODE_OPTIONS='--conditions=react-server' pnpm exec tsx tests/transaction-concurrency.test.ts` exercises the actual payment transaction with eight simultaneous retries and competing partial payments. It also checks the conditional database writes used for bed allocation and pharmacy stock. Expected losing updates return P2025. Synthetic fixtures are removed afterward. Use a dedicated development database with seeded synthetic admin accounts; this test is explicitly opt-in because it writes fixtures.

The payment service test verified one payment, one notification and one audit event for eight identical submissions. Two different collections exceeding the remaining balance allowed only one payment. Bed/stock guard tests each allowed one winner and retained nonnegative stock. These latter checks cover database primitives, not the complete admission or dispensing action lifecycle. Discharge/transfer and deposit transaction coverage was completed in the later inpatient suite. Pharmacy returns are covered by the later tests. Dispensing creation is covered by the later pharmacy tests.

Production-build browser verification passed: the payment dialog generated its submission ID, recorded a synthetic partial payment and accepted a replay without another payment row. TypeScript, targeted ESLint, the production build and the opt-in concurrency tests passed.

## Refund safety follow-up — November 23, 2026

Refund collection uses the existing payment submission key and invoice row lock. Repeated identical submissions return the original outcome; changed details under an already-used key are rejected. Decimal arithmetic keeps net payments and invoice status consistent with concurrent collections. Authorization remains in the server action, and validation/permission failures return messages to the existing refund form instead of replacing the page with an error.

The transaction test now covers eight identical refund retries, competing refunds that exceed available net payments, and a simultaneous payment/refund. It verifies final net payments, invoice status and refund audit count. No additional migration is required beyond `20261122000100_payment_retries`.

Verification: production build, TypeScript, targeted lint and the expanded transaction tests passed. Production-browser checks confirmed refund creation and an acknowledged retry without a second refund. The cashier had no refund form, and a direct server-action request returned “Refund permission required” without changing payment records.

## Pharmacy transaction follow-up — November 23, 2026

Dispensing now locks the prescription line before touching batch stock. Identical retries return its existing fill; attempts to change the batch or quantity of an already filled line are rejected. The original one-fill constraint remains in place. The server action still requires pharmacy.edit and explicit pharmacist verification. Stock deduction, low-stock notification, invoice, dispensing record and audit remain one transaction. No migration is required.

`RUN_HOSPITAL_TRANSACTION_TESTS=1 NODE_OPTIONS='--conditions=react-server' pnpm exec tsx tests/pharmacy-concurrency.test.ts` exercises the actual dispensing transaction against dedicated development data and cleans up its synthetic fixtures. Eight simultaneous identical submissions created one fill/invoice/audit and deducted stock once. Competing prescriptions could not oversell a batch. Expired batches and mismatched medicine names were rejected. A forced invoice foreign-key failure after stock deduction rolled the deduction back. Only successful fills created invoice items and charges.

This covers full dispensing creation and retries, but does not cover concurrent returns or all stock receiving/adjustment paths. Admission/transfer/discharge contention testing was completed in the later inpatient suite. Partial dispensing and verified medication-interaction data remain outside this increment.

Verification for the pharmacy increment: production build, TypeScript, targeted ESLint and the full dispensing transaction regression tests passed. The existing pharmacy interface is unchanged.

## Pharmacy return follow-up — November 23, 2026

Return forms submit the previously returned quantity. After locking the dispensing row, the server rejects a stale submission before creating a credit or restocking. Invoice credits, returned quantity, optional restocking and audit creation remain atomic. The existing pharmacy.edit authorization remains in the server action. No migration is required.

The pharmacy transaction regression now covers eight competing identical returns (one credit/restock), excessive return quantities, a simultaneous return and payment refund, and an audit failure after credit/restocking. It verifies the final invoice total, item sum, net payments, status, returned units and batch quantity. The failure case restored all balances. Returns marked unsuitable for restocking reduce the invoice without increasing stock.

Return verification passed: production build, TypeScript, targeted ESLint and the expanded pharmacy transaction suite. Admission, transfer, discharge and deposit contention checks were subsequently completed below.

## Inpatient transaction concurrency — November 23, 2026

Admission creation, status changes and deposit posting now live in internal transaction services called by the existing authorized server actions. Transfers include the original bed ID and check it after locking the admission; a stale concurrent transfer cannot move the patient a second time. No migration or visual redesign is required.

Run `RUN_HOSPITAL_TRANSACTION_TESTS=1 NODE_OPTIONS='--conditions=react-server' pnpm exec tsx tests/admission-concurrency.test.ts` against the dedicated seeded development database. It creates and removes synthetic patients, beds and related records. The suite covers:

- Two patients requesting the same bed and one patient requesting two beds: one admission succeeds, with no stranded allocation.
- Competing transfers of one admission and two admissions targeting one destination: one transfer succeeds, and stays/bed statuses remain consistent.
- Reservation confirmation versus cancellation: one decision takes effect with the matching encounter and bed state.
- Eight identical deposit submissions: one collection, followed by a deposit/discharge race with no lost payment.
- Concurrent discharge retries and transfer attempts during discharge: one settlement invoice/audit, no open stay, and the bed marked cleaning.
- Failures after writes during admission, transfer, deposit and discharge: all related bed, stay and financial changes roll back.

These checks replace the previously outstanding inpatient transaction contention checks for these scenarios. They do not establish complete clinical-pilot readiness: broader inherited route authorization, branch scoping, medication safety data and remaining feature acceptance still need review.

Final verification for this increment: targeted ESLint, TypeScript through the production build, the production build itself and the inpatient transaction regression suite passed.

## Security and appointment regression follow-up — November 24, 2026

Completed the scoped inherited-route and historical-record review, with details in [security-and-appointment-audit.md](security-and-appointment-audit.md). Central permission checks now deny hard deletion of retained clinical/financial/document records even for administrators. Completed treatments and clinically started appointments cannot be overwritten through legacy edit flows. Doctor summaries and private document/photo access are scoped; billing reads fewer patient fields. Staff role assignment requires permission-administration access, and password changes revoke sessions. R2 finalization validates owned staging uploads and publishes a separate final object; legacy public document URLs are blocked pending migration.

Appointment services now have repeatable database regression coverage for overlapping/concurrent bookings, adjacent slots, schedule hours, rescheduling, cancellation/no-show, check-in, walk-ins, completion billing, patient assignment and rollback. Ordered doctor locks prevent concurrent overlap inserts from deadlocking. Scheduling uses hospital-local instants and rejects invalid dates and nonexistent DST times.

Policy tests, appointment database tests, targeted lint, production build/TypeScript and production-browser permission smoke checks passed. No migration or UI redesign was required. Live R2 deployment verification, broader branch/custom-role scope and clinical-pilot acceptance remain outstanding; this is not a claim of full ERP completion.

## Custom-role patient scope — November 24, 2026

Closed the custom-role bypass in inherited patient, document, prescription, treatment and appointment authorization checks. Custom roles now require patient/staff assignment unless explicitly granted **Patients → All patients** in the existing Permissions matrix. Module permissions remain required, and built-in Doctor restrictions cannot be lifted by this grant. No UI redesign was needed.

Apply migration `20261124000100_custom_patient_scope`; it adds a permission row without granting existing custom roles broader access. Review custom administrative/reception roles for an intentional grant. Policy tests, the expanded appointment database regression, lint and production build passed. See the security audit follow-up for exact scope: operational worklists and dashboard aggregates retain their existing permission semantics, and branch isolation remains outstanding.

## Branch isolation, operational review and medication checks — November 24, 2026

Staff can switch among assigned branches. Added PostgreSQL row-level isolation, branch-linked-record validation, central patient enrollment, branch administration and audited grant/revocation with affected-session invalidation. Existing records remain in Main branch. Operational stock, admissions, billing, documents and clinical encounters are branch-specific; patient identity and medical history remain shared after enrollment. Dashboard queries now respect branch, assignment and module permissions.

All 12 built-in roles and a custom read-only role passed operational browser access checks. Branch isolation and transaction regression suites passed, including nested/raw reads, forged branch IDs, linked-record writes, rollback and concurrent context isolation. Production-browser branch switching, unassigned-branch denial, dashboard data minimization and live-session revocation passed.

Prescription signing now checks exact medicine identities/ingredients against NLM RxNorm, flags duplicate ingredients and allergy-text matches, and requires acknowledgement with an atomic audit record. Unknown names/outages require manual review. Live NLM lookup and automated safety-warning tests passed; this is not drug-interaction, dose or cross-reactivity clearance.

The development database has no legacy public document records. Added a controlled migration script and synthetic R2 verification script. **Live R2 remains unverified:** deployment URL and hospital bucket credentials have not been supplied. No deployment storage migration or public-source revocation was performed. See [the detailed deployment and verification notes](branch-storage-medication-readiness.md) before release. This increment does not establish complete clinical-pilot readiness.
