# Backup and Recovery

## Objectives
Define recovery point objective (RPO: acceptable data loss window) and recovery time objective (RTO: acceptable service restoration time) with the product owner before launch. No RPO/RTO is assumed by this document.

## Backup controls
- Use provider-supported database backups and point-in-time recovery where appropriate.
- Encrypt backups in transit and at rest.
- Restrict backup creation, access, retention changes, and deletion to authorised identities.
- Separate backup access from ordinary application credentials.
- Consider an independent protected copy for resilience against account compromise.
- Back up relevant configuration and migration history without copying secrets into insecure locations.
- Document retention and deletion requirements with privacy/legal review.

## Restoration exercise
1. Choose an approved isolated recovery environment.
2. Identify the backup/PITR point and record the intended recovery time.
3. Restore without overwriting the active production database.
4. Apply any documented recovery steps.
5. Verify schema/migration state, login and tenant boundaries, and application health.
6. Reconcile journal counts, debit/credit totals, selected account balances, and financial reports against trusted evidence.
7. Record actual recovery time and data-loss window.
8. Obtain sign-off and fix any gaps.

## Incident recovery
If data integrity is uncertain, suspend affected writes and preserve evidence. Select a recovery point only after assessing the incident timeline and potential malicious changes. Do not resume financial processing until accounting reconciliation and access-control validation pass.

## Required runbook details
Record provider/service, region, backup frequency, retention, encryption, access roles, alerting, restoration commands, dependencies, RPO/RTO, test date, test outcome, and owner. Never place live credentials in this document.
