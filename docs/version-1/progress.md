# Version 1 implementation progress

Baseline audit and 21-group parity matrix: [audit.md](audit.md). No live clinical release is approved.

## Completed in this increment

- Preserved the old divergent local `version-1` as `preserved-version-1-4db1d48`, then created `version-1` from the current hospital `main`.
- Ran all existing nine test suites against synthetic hospital data; all passed.
- Repaired manual invoice posting: serialized treatment checks, same-patient validation, duplicate prevention, decimal arithmetic, idempotent request ID, atomic authorization snapshot and audit. Repeatable database test `tests/manual-invoice.test.ts` passed.
- Added the first branch-scoped Revenue Guardian alert ledger and screen. A deterministic scan distinguishes pending lab orders (no claimed loss) from released lab tests without a LAB invoice, completed paid consultations without OPD invoice, dispensing amount mismatches, discounts/refunds needing review and discharged admissions missing IPD settlement. It records rule evidence and impact only when calculable. It never changes financial records. Open/reviewed alerts auto-resolve when source reconciles; repeated scans do not duplicate alerts. The released-lab alert acceptance test passed, including reconciliation and repeated scans.

## Still open

- Revenue Guardian thresholds/configuration, service source linkage, duplicate-charge and discharge unresolved-item rules, assignment/review lifecycle beyond basic review/dismiss, and full role/browser checks.
- Cashier reconciliation, supplier/purchase ledger, emergency triage with approved categories, public queue, follow-up consent/internal reminders, attendance, guidance, backup/restore rehearsal and broad UI acceptance.
- Pilot hospital clinical and operations reviewers remain unappointed. Punjab is a proposed pilot province pending hospital confirmation. Triage categories, financial thresholds, cashier policy and backup RPO/RTO/retention remain Awaiting Operator Approval.
- Live R2 configuration and deployment URL absent. No live storage claim.

## Release decision

**NO-GO for live patient care.** Synthetic development/testing only until high defects and acceptance gates are closed and the operator signs off.

Punjab-specific obligations must be checked with the operator and qualified reviewers against the [Punjab Healthcare Commission licensing guidance](https://os.phc.org.pk/licensingIntro.aspx) and [Minimum Service Delivery Standards](https://os.phc.org.pk/msdsImplimentation.aspx). This repository does not claim certification.

Current financial guard: until hospital thresholds and approval workflow are signed off, only explicitly authorized Admin/Super Admin accounts can post discretionary invoice discounts or refunds.

## Current 1–5 workstream (2026-11-24)

- **1 Revenue Guardian — partial:** Added draft amount/percentage thresholds, same-branch permission-checked reviewer assignment, activity history, duplicate treatment-charge detection, completed service-charge detection, and return-aware pharmacy reconciliation. Released-lab, service-charge, duplicate-treatment, unauthorized-discount, repeat-scan and reviewer-role tests pass. Threshold activation still awaits operator approval; full UI review and all source types need broader acceptance coverage.
- **2 Billing/cashier — partial:** Added recorded service charges with consolidated posting to one invoice, administrator-only pending-charge void, cashier shifts with payment linkage, administrator close approval, a printable method/discrepancy report and payment receipts. Added a read-only patient statement combining branch invoices from existing OPD/IPD/lab/pharmacy flows without rewriting history. Separate discount/refund requests require another administrator to apply a change atomically with audit. Cashier and two-person financial approval concurrency tests pass. Posted-invoice void policy, operator-approved closing rules and true cross-module single-invoice settlement remain open.
- **3 Emergency — partial:** Added emergency cases linked to central patients, clinician assignment, state changes, and transfer links to checked-in OPD visits or active admissions. Transaction test covers inactive triage denial, wrong-patient handoff denial, clinician scope and OPD/IPD links. Triage categories and escalation instructions are draft only; direct visit creation from emergency and clinical approval remain open.
- **4 Waiting board — functional baseline:** Public token/doctor/department/status board polls every 10 seconds. A live synthetic-token HTTP test confirms the token appears while patient name, MRN and ID stay absent, with `no-store` caching. Multi-branch display configuration and device-level usability testing remain open.
- **5 Follow-ups — functional baseline:** Clinical notes create due tasks; status, consent/opt-out and internal reminders are stored and audited. A uniquely matching due task links to a follow-up appointment; cancellation reopens it and completion closes it. An idempotent internal reminder job honors consent and omits patient details from notification text. Booking and reminder tests pass. The deployment operator must schedule `pnpm reminders:follow-ups` at its approved cadence; no outbound patient channel is activated.

The reminder CLI ran in the development environment and reported `branch-main: 0 internal reminder(s)` after the synthetic tests cleaned up. Scheduling it in deployment remains an operator task.

All six migrations in this workstream are additive and applied only to the dedicated `hospital_management_mvp` development database. The branch remains **NO-GO** for live patient care or financial use.

## Implementation update — 2026-11-26

This update supersedes the earlier open-item list where stated. Work remains on `version-1`; the UI and existing dental workflows are retained.

- [x] Added login throttling with keyed, normalized identifiers and concurrent failure counting; removed hardcoded development seed password and blocked production synthetic seeds.
- [x] Added conservative posted-invoice void: only authorized administrators, unpaid manual HINV invoices, no linked consolidated service charges, required reason, retained items and audit. Paid/automatic clinical/pharmacy invoices are rejected. Voids are excluded from balances and marked on HTML/PDF documents. Database guards block payments and changes after void.
- [x] Added signed branch waiting-board links and configuration screen. Invalid links fail closed. Two-branch token isolation and privacy tests pass. Fixed deferred-query branch-context execution discovered by this test.
- [x] Added separate append-only vital observations, observation/recording time, author, correction chains and independent review entries. Nurses can record but cannot review by default. Legacy clinical-note vitals are retained.
- [x] Added basic scheduled shifts, own check-in/out, overlap and duplicate-open checks, and administrator corrections with before/after audit.
- [x] Added supplier master, purchase-return workflow and immutable stock ledger. A database trigger captures receipts, dispensing, sale returns, purchase returns and adjustments. Existing stock is recorded as an explicitly labelled opening balance; historical movements are not fabricated.
- [x] Added role-filtered in-app guidance for reception, clinicians, nursing, lab, pharmacy, admissions and cashiers.
- [x] Added protected reminder and health endpoints for scheduler/monitoring integration. Existing CLI remains supported. Production query argument logging is disabled.
- [x] Added Revenue Guardian status/severity filters, visible severity/time and row-locked review service with explicit permission checks. Review/assignment/history and denied-role acceptance tests pass.
- [x] Added follow-up service permission tests and serialized status updates; opt-out/consent and closed-task protections pass.
- [x] Added laboratory workflow regression covering sample collection, draft result, independent verification, release, one linked invoice and payment.
- [x] Added encrypted backup/restore tooling. Synthetic rehearsal restored into an isolated temporary database with all **55** public table counts matching and branch-runtime access checks; temporary restore target removed. Real staging recovery and document restore remain required.
- [x] Created a dedicated development-only synthetic administrator account. Credentials are delivered in the task response, not committed in source.

### Still pending external verification or operator decisions

- Hospital approval of Guardian thresholds, discretionary financial policies, cashier closing policy and triage activation; named clinical/operations/regulatory reviewers and pilot requirements.
- Hosted reminder and backup scheduling, production monitoring/alerting, approved retention and measured recovery targets.
- Real PostgreSQL/staging credentials, R2 private bucket/CORS validation and any legacy public-document migration.
- Actual waiting-board device validation, visual/responsive/accessibility checks, physical printer verification and hospital stakeholder workflow acceptance.
- Complete user-driven reception → doctor → lab/pharmacy → settlement pilot and dental visual regression. Service/database regression evidence does not replace these gates.
- Existing OPD/IPD/lab/pharmacy invoices retain their individual identities. Patient statement aggregates them; it is not a replacement single cross-module invoice. Consolidated service-charge posting remains available.
- No separate general merchandise inventory or purchase-order approval subsystem was added; no operator-specific requirement for these was established. Existing medication receipts, supplier records, purchase returns and stock ledger are implemented.

**Release decision remains NO-GO for live patient care.** Internal synthetic testing may continue. See [deployment environment](deployment-environment.md) for the exact credentials/configuration required.

Final internal validation: **32/32 test files passed**, followed by the strengthened emergency handoff regression and TypeScript check. Production webpack build passed. Administrator/cashier/nurse/lab/pharmacist HTTP page-access checks passed. Browser screenshot/keyboard checks could not run because the browser access host was unavailable. Test account remains development-only. Source changes are not production deployment approval.

## Connected workflow and print verification — 2026-11-27

- [x] Closed a receiving retry defect: purchase receipts now have a branch-scoped request ID and payload fingerprint. Repeated/concurrent submissions post once; distinct deliveries to the same lot accumulate correctly. Receipt, stock movement and audit commit together. Receipts are immutable through the runtime role and visible in the existing stock-ledger screen.
- [x] Reused the existing registration, consultation, laboratory-order, prescription and dental logic through server services so connected tests exercise the same implementations as UI actions. Action URLs, validations, permission checks and redirects remain. Prescription and dental audit writes now commit with their records.
- [x] Connected synthetic workflow verifies one generated MRN despite concurrent registration, 32 retained dental teeth, appointment/token, doctor note, nurse observations, medication-review acknowledgement, dispensing, independent laboratory verification, admission deposit, transfer, discharge and complete settlement. Six source invoices reconcile to **172.00 synthetic charges**. No clinical meaning is assigned to test medicines or observations.
- [x] Corrected hospital-currency propagation across invoice creation/details/list/payment dialog, payment notifications, patient balances, treatment/dental prices, dashboard charts, expenses and reports. Formatter callers must provide currency explicitly. Actual hospital currency remains operator configurable; a temporary PKR test configuration is restored afterward.
- [x] Fixed the VOIDED invoice filter to query void metadata rather than an invalid Prisma invoice-status enum.
- [x] Inspected generated invoice/voided-invoice/prescription PDFs. Fixed unsupported prescription glyph, split medicine rows, long-reference overlap, continuation identification and void marking on every page. Multi-page PDF text, amount, page-reference and page-bound checks pass; these checks do not certify physical printer output.
- [x] Removed a treatment-edit client-boundary serialization warning by passing only required scalar form data and string amounts.
- [x] Added `pnpm test:hospital`, restricted to the dedicated synthetic database and a local application server. It runs both `.test.ts` and `.test.mts` suites and records a private local test log. Restart development after generating a new Prisma client/model.

The new receipt migration is additive and applies only to the synthetic database. Earlier receipts remain in the existing stock ledger; no historical receipt records are invented. Hospital approval, live deployment/R2/scheduling, actual devices/printers, browser accessibility and stakeholder acceptance remain open. The connected test validates server/database integration, not a hospital-approved browser pilot. **NO-GO for live patient care remains in force.**

Final increment verification: **35/35** guarded test files passed; production build, final TypeScript and targeted lint checks passed. All six synthetic PDF pages were rendered and reviewed. The encrypted restore rehearsal matched **56** table counts and validated receipt-table runtime access. No live deployment, real R2 credentials, approved operator policies or hospital sign-off has been supplied.
