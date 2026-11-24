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
- **2 Billing/cashier — partial:** Added recorded service charges with consolidated posting to one invoice, administrator-only pending-charge void, cashier shifts with payment linkage and cash discrepancy calculation, administrator close approval and printable payment receipts. Cashier transaction test passes. Separate discount/refund requests and approvals, posted-invoice void policy, comprehensive day-end review and consolidated OPD/IPD/lab/pharmacy settlement remain open.
- **3 Emergency — partial:** Added emergency cases linked to central patients, clinician assignment, state changes, and transfer links to checked-in OPD visits or active admissions. Triage categories and escalation instructions are draft only, with no approved categories or live clinical activation. Clinician workflow validation and direct handoff acceptance remain open.
- **4 Waiting board — functional baseline:** Public token/doctor/department/status board polls every 10 seconds. HTTP 200 and JSON have no patient identifiers; browser route renders. Multi-branch display configuration and device-level usability testing remain open.
- **5 Follow-ups — partial:** Clinical notes now create due tasks; status, consent/opt-out and manually generated internal reminders are stored and audited. Appointment linkage, automated reminder scheduling and cross-role acceptance remain open.

All four migrations in this workstream are additive and applied only to the dedicated `hospital_management_mvp` development database. The branch remains **NO-GO** for live patient care or financial use.
