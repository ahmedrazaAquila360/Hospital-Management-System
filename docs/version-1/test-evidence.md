# V1 internal test evidence — 2026-11-26

Environment: dedicated synthetic `hospital_management_mvp` PostgreSQL database; local Next server on port 3179. No real patient database, live R2 bucket or hospital deployment was tested.

## Regression run

All **32 test files passed** in the final regression run. Transaction suites require `RUN_HOSPITAL_TRANSACTION_TESTS=1` and `NODE_OPTIONS=--conditions=react-server`. HTTP suites use `WAITING_BOARD_TEST_URL=http://localhost:3179/api/waiting-board` and `HOSPITAL_TEST_ORIGIN=http://localhost:3179`. Never run these synthetic fixtures against production.

| Test file | Result |
|---|---|
| `tests/admission-concurrency.test.ts` | PASS |
| `tests/appointment-regression.test.ts` | PASS |
| `tests/attendance.test.ts` | PASS |
| `tests/branch-isolation.test.ts` | PASS |
| `tests/cashier-shift.test.ts` | PASS |
| `tests/emergency-transfer.test.ts` | PASS |
| `tests/financial-approvals.test.ts` | PASS |
| `tests/follow-up-access.test.ts` | PASS |
| `tests/follow-up-link.test.ts` | PASS |
| `tests/follow-up-reminder.test.ts` | PASS |
| `tests/guardian-financial.test.ts` | PASS |
| `tests/guardian-review.test.ts` | PASS |
| `tests/guardian-roles.test.ts` | PASS |
| `tests/invoice-void.test.ts` | PASS |
| `tests/job-endpoints.test.ts` | PASS |
| `tests/laboratory-workflow.test.ts` | PASS |
| `tests/login-throttle.test.ts` | PASS |
| `tests/manual-invoice.test.ts` | PASS |
| `tests/medication-safety.test.ts` | PASS |
| `tests/page-access.test.ts` | PASS |
| `tests/pharmacy-concurrency.test.ts` | PASS |
| `tests/report-calendar-db.test.ts` | PASS |
| `tests/report-calendar.test.ts` | PASS |
| `tests/revenue-guardian.test.ts` | PASS |
| `tests/security-policy.test.ts` | PASS |
| `tests/service-charge-guardian.test.ts` | PASS |
| `tests/stock-ledger.test.ts` | PASS |
| `tests/transaction-concurrency.test.ts` | PASS |
| `tests/vitals.test.ts` | PASS |
| `tests/waiting-board-branches.test.ts` | PASS |
| `tests/waiting-board-token.test.ts` | PASS |
| `tests/waiting-board.test.ts` | PASS |

## Additional checks

- TypeScript `pnpm exec tsc --noEmit`: passed after correcting branch-helper generic typing and explicit test response types.
- Targeted ESLint for added operational pages, services and scripts: passed.
- `git diff --check`: passed.
- Prisma schema validation: passed; six additive migrations applied to the synthetic database only, bringing the local total to 41 migrations.
- Encrypted backup rehearsal: restored into a uniquely named temporary database, matched all 55 public table counts and verified branch-runtime reads; temporary database removed. A fresh rehearsal also covered the latest invoice protection functions.
- HTTP page checks exercised administrator, cashier, nurse, laboratory technician and pharmacist sessions. Denied pages redirected to the access page. These checks validate rendering and access, not visual or physical-device usability.

## Evidence limits

Service/database tests are not full human-operated UI acceptance. No claim is made for actual printer output, complete keyboard/screen-reader accessibility, lobby-device suitability, live R2/CORS, hosted scheduler execution, production monitoring delivery, staging recovery duration, actual dental visual regression, clinical validation or regulatory approval. See `pilot-runbook.md` and `deployment-environment.md` for remaining release gates.

Production webpack build: passed compilation, TypeScript and page generation; completion recorded after final build trace collection. Build output is kept in the local `/tmp/hospital-v1-verified-build.log` during this session. Raw synthetic test output is in `/tmp/hospital-v1-final-tests.log`; these temporary logs are not committed.

A final targeted emergency regression also passed after requiring a receiving encounter before OPD/IPD handoff. It covers same-patient links, clinician scope, missing-workspace denial and immutable completed handoff. Subsequent TypeScript validation passed. Browser visual verification was attempted, but the browser access host was unavailable; no screenshot or visual approval is claimed.
