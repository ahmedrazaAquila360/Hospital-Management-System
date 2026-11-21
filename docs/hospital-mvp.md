# Hospital MVP implementation record

The baseline is the six-page DentalHub feature inventory dated November 20, 2026, checked against the App Router routes, server actions, permission catalog and PostgreSQL schema. This repository uses the existing staff shell and shared components. The local hospital database starts from the existing migration chain and has its own database URL and session cookie.

## Feature mapping

| Existing inventory | Hospital implementation | Remaining acceptance work |
|---|---|---|
| Public website and booking requests | Existing public pages and reception review | Outside the redesign scope |
| Login, staff, custom roles, user overrides | Database sessions, hospital role defaults and dedicated lab, OPD, IPD and pharmacy action permissions | Verify object access on every inherited route and download |
| Dashboard and reports | Existing revenue, balance, calendar and registration queries plus OPD, census and bed counts | Emergency census, departmental date filters, activity feed and service revenue totals implemented. Remaining inherited reporting dates require timezone regression. |
| Patients and medical history | Central Patient ID, sequence-issued MRN, demographic duplicate check, insurance and surgical history, connected visit and admission tabs | Serialized duplicate detection and patient archiving implemented. Retention review for other inherited delete paths remains. |
| Calendar and booking | Existing day/week/month views, staff schedules, department snapshot and database overlap exclusion | Walk-in shortcut, full concurrency and timezone regression suite |
| Dental chart and treatment | Historical dental tables and procedure prices retained. Encounter and append-only ClinicalNote handle outpatient documentation | Inpatient notes and signed amendment chains implemented. Amendment browser regression remains. |
| Prescriptions | Existing multi-line prescription, appointment association, print and PDF. OPD opens contextual prescription creation | Route and catalog suggestions implemented. Recorded-allergy acknowledgement requires clinician review. Verified interaction data integration remains. |
| Invoices, expenses and payments | Existing billing, printed invoices, expenses and reports. Payment posting locks the invoice. Completed consultations with configured fees, released tests and dispenses create invoices | Refunds, authorized discounts, deposits and bed charge settlement implemented. Full concurrent posting regression remains. |
| Files and notifications | Private local clinical uploads, session-checked downloads, private R2 configuration, existing notification bell, lab release event | Review older file grants, remote upload validation and configurable delivery |
| Hospital settings, departments, doctors | Registration details, department directory and assignments, doctor account profiles, weekly hours and consultation pricing | Service catalog and optional Branch relationships implemented. Branch-level access enforcement remains. |
| Laboratory | Catalog, prices and reference text, sample tracking, result entry, separate verifier, release and patient history | Printable released report implemented. Range-specific numeric interpretation remains. |
| Pharmacy | Medication and batch records, receiving, expiry/quantity guard, audited dispensing, invoice linkage | Returns, audited adjustments and expiry indicators implemented. Partial fills and scheduled expiry notifications remain. |
| Admissions and beds | Ward/room/bed identifiers, bed board, transfers, discharge request, signed summary and housekeeping | Inpatient clinical workspace, orders, deposits, bed tariffs and discharge invoice implemented. Full inpatient browser regression remains. |

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

The final admission reservation, deposit settlement, signed amendment and concurrent-write paths still need dedicated browser and contention tests. The current implementation remains a development MVP pending those checks and the outstanding items in the feature mapping.

Local development uses database hospital_management_mvp. Staff login credentials use HOSPITAL_DEMO_PASSWORD in the local .env file. The seed uses synthetic accounts only. The retained DENTIST database role is displayed as Doctor.

Bed charging uses hospital calendar nights, with one day charged for an admission and discharge on the same calendar day. A transfer retains each bed's rate at allocation time. This billing convention is an implementation assumption for hospital review.

Discharge report verification passed through the browser. An authorized administrator opened a completed synthetic admission's printable summary and saw the saved discharge instructions. An anonymous request to the same report redirected to login. The admission register now links completed admissions to this report. TypeScript and targeted lint checks passed.
