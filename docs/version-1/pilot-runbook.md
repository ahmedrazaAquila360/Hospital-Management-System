# V1 pilot runbook

Current authorized scope: synthetic internal testing. **NO-GO for live patient care** until the release gates in progress.md are closed. The proposed Punjab pilot hospital and reviewers are not confirmed.

## Before a pilot

- [ ] Confirm the pilot hospital, branch names, departments, services, prices, timezone and currency with its administrator.
- [ ] Name clinical, laboratory, pharmacy, reception, finance and operations reviewers; record sign-off evidence and unresolved findings.
- [ ] Approve triage categories/escalation instructions, discount/refund authorization and cashier closing procedures. Draft settings are not approval.
- [ ] Review actual role/permission and assigned-branch access using named operator accounts, including custom roles.
- [ ] Validate hosted migrations against a recovered staging copy, encrypted database backups, private document backups and timed restore.
- [ ] Configure and observe scheduled reminder/backup executions and monitoring alerts. Set approved retention/RPO/RTO and owners.
- [ ] Verify private R2 uploads/downloads, exact-origin CORS, unauthorized access denial and legacy-public-document migration.
- [ ] Test lobby displays on each intended device and branch, including network loss and recovery.
- [ ] Complete realistic reception/OPD/lab/pharmacy/billing and admission/transfer/discharge settlement workflows with stakeholders.
- [ ] Inspect prescription, result, discharge, receipt, invoice and VOIDED invoice output on the intended printers. Test keyboard navigation, mobile layouts and readable focus/error states.
- [ ] Verify retained dental workflows and approved medicine dataset coverage. Warnings do not establish clinical safety approval.
- [ ] Confirm applicable requirements with the hospital's authorized management and qualified clinical/regulatory reviewers. No certification is claimed.

## Access and training

Use individually named accounts and least required permissions. Assign approved branches and verify the branch selector before entering records. Follow `/guidance` for module steps. Never share the development administrator account with production users. The local test-account creation command only accepts the synthetic database and rotates its generated password each time.

## Daily operational checks after an authorized pilot starts

An appointed operations owner checks active branch access, queues and lab worklists; stock and expiry exceptions; Revenue Guardian alerts; invoice/payment/return linkages; cashier discrepancies; scheduler logs; backup success and monitoring. Resolve alerts by reviewing evidence and following approved workflows. Guardian never auto-charges a patient. Preserve clinical amendments, stock movement records and financial audit history.

## Support and incident process

Before activation, the hospital must fill in a primary support contact, backup contact, clinical escalation owner, hosting/database owner and availability expectations. These have not been supplied and must not be invented.

Record incidents with time, module, non-sensitive record reference, observed behavior and operational impact. Avoid patient data, credentials and document contents in logs or screenshots. Escalate suspected patient-safety or financial-integrity issues to the appointed clinical/finance owner immediately; suspend the affected workflow until reviewed. Keep a tested operator-approved downtime procedure available.

For recovery, preserve the failed system and logs, restore the encrypted backup into a **separate empty** environment, restore private documents, verify role grants/branch policies and application workflows, reconcile records since the backup with hospital owners and obtain authorization before switching live service. Do not reset the live database or silently replace its data.

## Known limitations requiring explicit pilot review

- Existing source invoices remain separate across OPD, lab, pharmacy and admissions. Patient statements aggregate balances; consolidated pending service charges can post into a single invoice.
- Only unpaid, unlinked manual invoices can be voided. Automatic clinical/pharmacy invoices and invoices with any payment require an authorized correction/refund process.
- Stock ledger starts with labelled opening balances; earlier activity remains in existing audit history. Supplier financial settlement is separate from physical purchase returns.
- No approved triage framework, financial thresholds, backup retention or recovery target is supplied.
- In-app guides and technical tests do not constitute clinical, operational or regulatory approval.
