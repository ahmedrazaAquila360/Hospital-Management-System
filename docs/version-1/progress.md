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
