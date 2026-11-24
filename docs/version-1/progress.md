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
