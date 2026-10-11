# Deployment Runbook

This is a deployment checklist template. It does not claim that production infrastructure already exists.

## Before deployment
- [ ] Confirm target commit, release notes, and product owner approval.
- [ ] Review CI results: lint, typecheck, unit tests, E2E tests, build.
- [ ] Review schema migrations and recovery/forward-fix plan.
- [ ] Confirm environment variables and secrets are configured outside source control.
- [ ] Confirm TLS, allowed origins, secure cookie/session settings, rate limits, and security headers.
- [ ] Confirm production database identity has least privilege.
- [ ] Confirm seed scripts and demo credentials cannot create public default accounts in production.
- [ ] Confirm backups completed and the restore process was recently tested.
- [ ] Confirm monitoring, error alerts, health checks, and log redaction.
- [ ] Confirm no unresolved release-blocking accounting/security risk.

## Deploy
1. Announce the deployment window and identify the operator.
2. Verify the exact commit and target environment.
3. Apply reviewed migrations using the production migration command.
4. Deploy API and web artefacts in the documented order.
5. Run health checks and a safe smoke test using synthetic or approved test data.
6. Confirm authentication, tenant scope, key accounting journeys, and report endpoints.
7. Check error rates, logs, and database health.
8. Record outcome, timestamps, commit, migration version, and any deviations.

## Rollback and recovery
- Do not assume an application rollback is safe after an irreversible schema migration.
- Follow the migration-specific recovery plan; prefer forward fixes where rollback risks data loss.
- If data integrity is in doubt, stop financial writes and preserve evidence before repair.
- Restore backups only through an approved procedure and validate ledger totals after recovery.
- Notify affected stakeholders and record the incident and follow-up actions.

## AWS note
AWS remains a candidate platform, not an approved architecture in this document. Before choosing services, document region/data residency, expected load, availability target, recovery point/time objectives, access model, cost budget, observability, and operator responsibilities.
