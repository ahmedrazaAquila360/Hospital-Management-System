# V1 additive migration notes — 2026-11-26

Only the dedicated synthetic `hospital_management_mvp` database was migrated. The original Dental Hub database and production environments were not changed.

| Migration | Effect |
|---|---|
| `20261124001600_login_throttle` | Global keyed login-failure counter; inaccessible to branch runtime. No raw email stored. |
| `20261124001700_invoice_void` | Nullable invoice void metadata, index, explicit admin permission and payment guard. Original invoice/items retained. |
| `20261126000100_vital_observations` | New observation/review tables, branch RLS, visible-link checks and granular permissions. Existing clinical JSON retained. |
| `20261126000200_attendance` | New shifts, timestamp checks, one open shift per user, branch RLS and self/manager permissions. |
| `20261126000300_stock_ledger` | New supplier and stock-movement tables. Explicit opening balance backfill and supplier-name backfill from existing batches. Quantity trigger records future movements. Negative stock and direct runtime ledger edits are blocked. |
| `20261126000400_invoice_void_guards` | Serializes payment inserts against void updates and rejects paid/linked voids or updates to voided invoices. |

Review these SQL files before deployment, take a backup and apply with `pnpm exec prisma migrate deploy`. Existing custom roles gain own-attendance permission in the attendance migration; managers should review this new self-service access. Clinical vital permissions are added only to administrator/doctor/nurse defaults as specified. Existing custom roles require explicit clinical permissions and remain subject to assignment controls.

No destructive down migration is supplied: dropping new tables after staff enter records would erase history. Use a tested backup/recovery plan rather than resetting the database. The encrypted local rehearsal successfully restored all 55 table counts and tested runtime grants; staging recovery with the real PostgreSQL provider, private documents, encryption-key custody and actual recovery timing is still required. Restore tooling refuses an existing nonempty target.

The new stock ledger begins at its activation balance. It does not reconstruct earlier transactions or replace earlier activity logs. Purchase returns change physical stock and record purchase value; they do not automatically create supplier payments or refunds.

## Additional receipt migration

`20261126000500_pharmacy_receipts` adds immutable, branch-scoped purchase receipts with a unique submission ID, request fingerprint, batch reference, quantity, supplier snapshot, purchase value and actor. Receiving writes the receipt, stock movement and audit atomically. No existing batch or patient records are removed; no historical receipts are fabricated. Earlier receiving activity remains in the stock ledger. Restart application processes after Prisma generation so they load the new model. The development database now has 42 migrations.
