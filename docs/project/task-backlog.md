# Project Task Backlog

Use GitHub Issues as the detailed work queue. This document contains the initial audit backlog; update it as issues are created and closed.

## P0 — Before any production claim
- [ ] AUD-001: Map repository modules, routes, Prisma models, migrations, scripts, environment variables, and deployed services.
- [ ] AUD-002: Re-run install, lint, typecheck, tests, and production build on a clean checkout; record exact results.
- [ ] SEC-001: Verify all tenant-scoped endpoints enforce membership and permission checks.
- [ ] SEC-002: Confirm no real credentials or usable demo accounts are exposed in production.
- [ ] ACC-001: Verify posting is atomic, concurrency-safe, and cannot duplicate financial effects.
- [ ] ACC-002: Verify posted entries cannot be silently modified/deleted and reversals preserve traceability.
- [ ] REP-001: Reconcile trial balance, P&L, and balance sheet using independent fixtures.
- [ ] OPS-001: Document actual deployment topology, secrets, backups, restore, monitoring, and rollback.

## P1 — Reliability and evidence
- [ ] QA-001: Add route-by-route role/tenant negative tests.
- [ ] QA-002: Add concurrent sequence and duplicate-posting tests.
- [ ] QA-003: Test migration from a clean database and from a representative prior schema.
- [ ] SEC-003: Run dependency, secret, and static security scans.
- [ ] PRIV-001: Inventory personal data and define retention/access/deletion processes.
- [ ] DOC-001: Add API contracts and the current permission matrix.
- [ ] DOC-002: Replace historical test claims in README with current dated evidence or clearly label them historical.

## P2 — Product maturity
- [ ] UX-001: Review accessibility, responsive behaviour, empty/error states, and critical user journeys.
- [ ] OPS-002: Conduct a backup restoration exercise and record measured recovery results.
- [ ] OPS-003: Establish production dashboards and actionable alerts.
- [ ] REL-001: Define pilot onboarding, support, incident communication, and feedback handling.

For each task record owner, priority, requirement IDs, acceptance criteria, dependencies, test evidence, documentation touched, and outcome.
