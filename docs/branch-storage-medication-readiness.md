# Branch, operational access, document storage and medication review

Implementation review: November 24, 2026. Original DentalHub data and repository were not modified.

## Branch isolation

Staff can belong to multiple branches. The header switches the active branch in the authenticated database session. The server validates membership; changing a submitted branch ID cannot grant access. Permissions remain account-wide and are evaluated separately from branch membership.

The database client runs application queries and transactions under the non-login, non-superuser, non-bypass-RLS `hospital_branch_runtime` role, with a transaction-local branch setting. This applies to raw reporting SQL and nested Prisma relations as well as ordinary queries. Existing array and callback transactions retain atomicity. PostgreSQL row policies scope operational tables, and triggers reject references to records unavailable in the active branch. Branch IDs on existing operational records cannot be changed through runtime writes.

Historical operational data is assigned to Main branch. Patient identity, demographics, allergies and longitudinal medical history remain central. `PatientBranch` enrollment controls which branches can open that central patient. Visits, prescriptions, laboratory orders, admissions, beds, financial records, stock and documents remain in their originating branch. Registering a matching identity checks the central registry without returning another branch's clinical information. Enrollment requires the existing MRN and patient-create permission; it is audited. This is one hospital with multiple branches, not separate hospital tenants.

The Branches page requires permission administration. Creating branches also requires settings editing; assigning staff requires staff editing. All administrative grants are audited. Departments are assigned per staff/branch membership. Department names, services, bed labels and pharmacy lots can repeat between branches. Hospital settings, medication/test catalogs and role definitions are shared hospital configuration. Public appointment requests retain the original Main branch; public-website redesign remains excluded.

**Deployment:** run `pnpm exec prisma migrate deploy`, then rebuild. The migration account needs role-creation/grant authority. The application database account must be able to `SET ROLE hospital_branch_runtime`. Never replace application imports of `src/lib/prisma` with `prisma-base`; the latter is reserved for authentication, explicit hospital-wide administration and controlled maintenance. New operational tables require a branch column, row policy, linked-record validation and runtime grants. Do not grant BYPASSRLS or superuser to the runtime role. Privileged database administration is outside application isolation.

## Operational permissions and dashboard

| Role / permission | Operational access |
| --- | --- |
| Hospital/Super Admin | Manage operational modules within the selected branch |
| Lab technician (`lab.view`, `lab.edit`) | Branch worklist, sample/result entry; approval requires `lab.approve` |
| Pharmacist (`pharmacy.view`, `pharmacy.edit`) | Branch prescriptions, dispensing and returns; stock administration requires `pharmacy.manage` |
| Inventory manager (`pharmacy.view`, `pharmacy.manage`) | Stock; prescription/dispensing lists remain hidden without dispensing permission |
| Nurse (`ipd.view`, `ipd.edit`) | Branch inpatient worklist and permitted transfers; discharge requires `ipd.approve` |
| Cashier / billing officer | Financial permissions do not grant lab, pharmacy or inpatient clinical worklists |
| Doctor | Assigned consultations and released reports through clinical access; operational worklists need their separate module permissions |
| Custom roles | Same explicit module permission rules and branch isolation; patient-profile assignment restrictions remain separate |

Laboratory verification still requires a different staff member from result entry. Prescription dispensing still requires explicit pharmacy verification and rejects expired stock. Pharmacy and admission mutations now also require their module's view permission. Branch isolation applies even to administrators' operational pages.

Dashboard/report queries now run in the active branch. Assigned-only actors have scoped patient, appointment, treatment and admission summaries; department census is withheld from these actors. Financial queries require billing visibility and are skipped otherwise. Bed summaries require inpatient visibility. There is no implicit hospital-wide aggregate view after switching branches.

## Document storage

The development audit found **zero legacy public document records**. No source files were deleted. `scripts/migrate-legacy-documents.ts` defaults to a count-only dry run. Opt-in migration validates file signatures/size, uses explicit HTTPS hostname allowlisting, disallows redirects and updates each document to private local storage with an audit entry. It retains the source until its storage owner can verify the migration and revoke public access; it never changes original DentalHub storage. A deployment using local private storage must provide a persistent `HOSPITAL_UPLOAD_DIR`.

`NODE_OPTIONS='--conditions=react-server' pnpm exec tsx scripts/verify-hospital-r2.ts` creates only a synthetic temporary PDF, checks the configured origin's PUT preflight, signed upload, owned finalization, signed download, unsigned denial and wrong-owner rejection, then removes its test objects. Configure `HOSPITAL_R2_ACCOUNT_ID`, `HOSPITAL_R2_ACCESS_KEY_ID`, `HOSPITAL_R2_SECRET_ACCESS_KEY`, `HOSPITAL_R2_BUCKET` and `HOSPITAL_APP_ORIGIN` in the deployment's secure environment. Do not put keys in source control or chat.

**Live R2 status: not verified.** No hospital R2 credentials or deployment URL were provided. The verifier exits with a configuration error instead of claiming success. Actual bucket privacy, CORS and deployment-route download checks remain dependent on that configuration. No real deployment migration was attempted.

## Medication checks

Prescription signing now queries NLM RxNorm using exact active medicine-name matches and resolves ingredient identifiers. Ambiguous/unresolved names and network failure produce a manual-review warning, never a safe result. The checks flag duplicate ingredient identifiers within the prescription and ingredient-name mentions in recorded allergy text. No patient identity or allergy text is sent to NLM; only medicine names are queried.

The prescriber must acknowledge the current regimen and warnings. The acknowledgement is bound to submitted medicines and current allergies; changed data requires another review. The prescription and verification evidence (source, resolved identities/ingredients, warnings, time and acknowledgement fingerprint) are stored atomically in the prescription/audit transaction. Allergy text is rechecked before saving.

This does **not** evaluate dose suitability, interactions, allergy classes/cross-reactivity or every existing medication. Free-text allergies cannot prove absence of risk. It supplements the existing clinician/pharmacist review and is not an automated clinical clearance. NLM discontinued RxNav's drug-interaction service; a separately validated clinical knowledge source would be required to add that feature.

Sources: [NLM exact matching](https://lhncbc.nlm.nih.gov/RxNav/APIs/api-RxNorm.findRxcuiByString.html), [NLM ingredient relationships](https://lhncbc.nlm.nih.gov/RxNav/APIs/api-RxNorm.getRelatedByType.html), [NLM interaction-service status](https://www.lhncbc.nlm.nih.gov/RxNav/information/FAQs.html).

## Verification

- `tests/branch-isolation.test.ts`: two synthetic branches; reads, writes, raw SQL, nested relations, aggregates, forged branch IDs, cross-branch foreign links, central-patient enrollment, transaction rollback, array transactions and concurrent branch contexts.
- Appointment, payment/refund, pharmacy and admission concurrency suites rerun with branch isolation enabled, including forced failure/rollback paths.
- `tests/medication-safety.test.ts`: duplicate ingredients, allergy-text matches, unresolved names, unavailable provider and acknowledgement changes. `RUN_MEDICATION_LIVE_TEST=1` also verified amoxicillin RxCUI 723 and its ingredient against the live NLM API.
- Prisma validation, TypeScript, lint and production build; browser role/branch results recorded below after completion.

Browser verification passed for all 12 built-in roles plus a custom read-only operational role across laboratory, pharmacy and inpatient routes. Assigned-branch switching worked; replaying a switch with an unassigned branch ID did not change the session. The isolated branch showed no Main-branch patients. A dashboard-only custom account with its own synthetic assigned patient received neither patient details nor financial cards. Removing its branch assignment invalidated its live session. Revocation retains inactive membership records for historical staff-name display and excludes the account from new-doctor selection.
