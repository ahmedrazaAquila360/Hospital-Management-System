# Hospital V1 environment and deployment handoff

Use a dedicated hospital database. Keep the original Dental Hub database unchanged. Provide secrets through your deployment secret manager or local ignored `.env`; never commit them or put them in screenshots, tickets, or chat. Prisma CLI reads `.env` or exported process variables. Next also reads `.env.local`.

## Values the deployment operator must provide

| Variable | Purpose | Required |
|---|---|---|
| `HOSPITAL_DATABASE_URL` | Dedicated PostgreSQL connection, including provider SSL settings | Yes |
| `HOSPITAL_AUTH_HMAC_KEY` | Random secret, at least 32 random bytes, for hashed login throttle identities | Yes for production |
| `HOSPITAL_APP_ORIGIN` | Exact HTTPS origin, without a trailing slash or path | For live storage verification |
| `HOSPITAL_WAITING_BOARD_KEY` | Separate random secret, at least 32 characters; signs branch display links | For branch lobby displays |
| `HOSPITAL_JOB_TOKEN` | Separate random secret, at least 32 characters; protects reminder and health endpoints | For scheduled jobs/monitoring |
| `HOSPITAL_R2_ACCOUNT_ID` | Cloudflare account identifier | If using R2 |
| `HOSPITAL_R2_ACCESS_KEY_ID` | Dedicated restricted bucket credentials | If using R2 |
| `HOSPITAL_R2_SECRET_ACCESS_KEY` | Dedicated restricted bucket secret | If using R2 |
| `HOSPITAL_R2_BUCKET` | Dedicated **private** hospital bucket | If using R2 |
| `HOSPITAL_UPLOAD_DIR` | Persistent private directory outside the public web root | If using local private files |
| `HOSPITAL_BACKUP_KEY` | Base64-encoded 32 random bytes for AES-256-GCM backups; store separately from backups | For backup tooling |
| `HOSPITAL_BACKUP_DIR` | Absolute restricted persistent backup directory, outside public assets | For backups |
| `HOSPITAL_RESTORE_DATABASE_URL` | Separate, empty staging restore target; never the live database | For restore verification |
| `HOSPITAL_DEMO_PASSWORD` | Development-only synthetic seed password, minimum 16 characters | Development seed only |

Optional login controls: `HOSPITAL_LOGIN_MAX_FAILURES`, `HOSPITAL_LOGIN_WINDOW_MINUTES`, `HOSPITAL_LOGIN_LOCK_MINUTES`. Defaults are 5/15/15; accepted values are integers from 1 through 120. These are technical login limits, not clinical or cashier policies.

Generate distinct secrets with `openssl rand -hex 32`; generate the backup key with `openssl rand -base64 32`. Do not reuse these keys. Changing the display key revokes previously generated branch display links. Changing the authentication HMAC key resets the throttle identity namespace.

## Deployment steps

1. Confirm hosting platform, application domain, dedicated PostgreSQL version/access, persistent storage and approved scheduler. Install matching `pg_dump`/`pg_restore` clients on the backup runner.
2. Back up the existing hospital database. Review additive migrations, then run `pnpm exec prisma migrate deploy` using deployment database credentials. Never run reset or seed against production. No production migration has been run by this implementation.
3. Build with `pnpm run build`; run with `pnpm start`. Terminate HTTPS at the trusted hosting platform. Configure restricted runtime database privileges and verify `hospital_branch_runtime` membership/grants and branch policies on the actual server.
4. Create named operator accounts with assigned branches and reviewed permissions. Synthetic accounts must not be copied into production.
5. Configure private R2 access and exact-origin CORS, then run `pnpm exec tsx scripts/verify-hospital-r2.ts`. Verify that unauthorized app downloads fail and unsigned object requests are denied. Migrate any legacy public documents using the existing storage migration procedure. Credentials and live bucket verification are still pending.
6. Configure the scheduler at the **operator-approved cadence**. A persistent runner may execute `pnpm reminders:follow-ups`. HTTP schedulers may POST to `/api/jobs/follow-up-reminders` with `Authorization: Bearer <HOSPITAL_JOB_TOKEN>`. The endpoint uses the existing idempotent job across branches and never sends SMS/WhatsApp. Confirm a scheduled execution in deployment logs; adding this endpoint does not itself create a hosted schedule.
7. Monitor authenticated `GET /api/health` with the same bearer-token mechanism. Alert on non-200 responses, failed reminder runs and failed backup runs. These endpoints return no patient data. Production Prisma query logging is disabled to avoid emitting record arguments. Hosting log access and retention still require operator configuration.
8. Open `/settings/waiting-board` in each assigned branch to obtain its signed display link. Test font size, token visibility, network loss and recovery on the actual lobby devices. The legacy `/waiting-board` link remains the main-branch display.

## Encrypted backup and restore

```
pnpm exec tsx scripts/hospital-backup.ts backup
pnpm exec tsx scripts/hospital-backup.ts restore /private/path/backup.hmsbak
```

Restore refuses a nonempty target database. It does not overwrite existing records. Backup files use authenticated encryption; an incorrect key or tampered file fails decryption. Protect and separately escrow the key: losing it prevents recovery. The script requires PostgreSQL tools and the `hospital_branch_runtime` role on the restore server; preserve role grants and policies. Back up private documents/R2 objects and configuration separately. A database backup alone does not restore documents.

Schedule encrypted backups using the deployment scheduler only after retention, RPO, RTO, location and access owners are approved. No unapproved retention policy or automatic deletion is enabled. Monitor the scheduler exit status and backup age. Test actual recovery duration and document storage restoration in staging before production approval. The current backup implementation stages a custom-format database dump privately and encrypts it; memory/disk sizing must be validated against the deployment dataset.

Local synthetic rehearsal:

```
pnpm exec tsx scripts/hospital-backup.ts rehearse
```

This mode only accepts the synthetic `hospital_management_mvp` database. It creates a uniquely named temporary database, restores an encrypted backup, compares every public table count, tests branch-runtime reads and drops only its own temporary database. A temporary encryption key was used for the development rehearsal and was not persisted.

## Policies and sign-off still needed

Pilot hospital/domain and hosting access; confirmed Punjab location; named clinical and operations reviewers; approved triage categories/escalation instructions; approved discount/refund and cashier closing policies; backup retention/RPO/RTO; support contacts and incident escalation. Thresholds remain drafts. No clinical, financial policy, regulatory or production approval is claimed.

## Repeatable internal release checks

After applying development migrations and regenerating Prisma, restart the local server, then run:

```
RUN_HOSPITAL_TRANSACTION_TESTS=1 HOSPITAL_TEST_ORIGIN=http://localhost:3179 pnpm test:hospital
```

The runner refuses production mode, a database other than the dedicated synthetic `hospital_management_mvp`, and a nonlocal HTTP target. Tests create and clean synthetic records; the PDF test temporarily switches the synthetic hospital currency to PKR and restores it. Do not run concurrent writers during a backup rehearsal or this configuration test.

PDF samples are created under `/tmp/pdfs/hospital-v1`. For additional content/bounds/raster checks, use an isolated Python environment with PyMuPDF and run `python scripts/verify-pdf-samples.py`. The checks validate currency, all medicine rows, page references, repeated void marks and text bounds. Inspect the generated PNGs and test actual hospital printers separately.
