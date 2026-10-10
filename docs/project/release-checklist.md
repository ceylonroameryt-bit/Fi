# Release Checklist

## Scope and review
- [ ] Release scope and known limitations are written down.
- [ ] Product owner has reviewed material changes.
- [ ] Requirements and acceptance criteria are linked to implementation and tests.
- [ ] Risk register is reviewed; unresolved critical risks block release unless formally accepted by an authorised decision-maker.

## Code and database
- [ ] Formatting/lint passes.
- [ ] API and web typechecks pass.
- [ ] Unit, integration, E2E, and relevant security tests pass.
- [ ] Production build passes from the release commit.
- [ ] Migration SQL reviewed and tested.
- [ ] No secrets, real customer data, or unsafe demo credentials included.
- [ ] Dependency and secret scans reviewed.

## Accounting and security
- [ ] Journal balance and lifecycle invariants verified.
- [ ] Posting concurrency/idempotency and rollback verified.
- [ ] Reversal and locked-period behaviour verified.
- [ ] Tenant isolation and role permissions tested across resource families.
- [ ] Trial balance and financial statements reconcile.
- [ ] Audit history and log redaction verified.
- [ ] CSV/export safety checked.

## Operations
- [ ] Environment-specific secrets and settings reviewed.
- [ ] TLS, security headers, allowed origins, cookies, and rate limits reviewed.
- [ ] Health checks, alerts, and log access verified.
- [ ] Backup completion and recent restore evidence confirmed.
- [ ] Deployment and rollback/recovery instructions are current.
- [ ] Smoke tests passed in staging or the approved target environment.

## Sign-off
Record release version, commit SHA, environment, date, operator, test evidence, unresolved risks, rollback decision, and approval. Do not mark this checklist complete without evidence.
