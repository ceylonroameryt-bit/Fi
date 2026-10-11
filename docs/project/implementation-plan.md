# Implementation Plan

This plan is ordered by risk. Dates and estimates are intentionally not assigned until the baseline audit establishes the actual state of the code.

## Step 1 — Establish the baseline
- [ ] Inventory repository directories, packages, API routes, services, guards, Prisma models, migrations, scripts, and deployment configuration.
- [ ] Run clean install, lint, typecheck, unit tests, E2E tests, and production build; record exact command outputs and commit.
- [ ] Compare README claims with source and current test results.
- [ ] Record the real product name, supported user workflows, hosting setup, and demo-account behaviour.
- **Exit:** baseline report and prioritised risks are accepted.

## Step 2 — Close integrity and security gaps
- [ ] Trace tenant scoping through every route, service, query, export, and background task.
- [ ] Build the role-to-action permission matrix and add negative tests.
- [ ] Trace journal validation, posting transaction, sequence allocation, reversal, period locking, and audit writes.
- [ ] Review session expiry/revocation, password reset, rate limiting, secrets, and logging.
- **Exit:** critical risks are mitigated or explicitly block launch.

## Step 3 — Prove accounting correctness
- [ ] Create independent fixtures for journal lifecycle, opening balances, reversals, locked periods, and report calculations.
- [ ] Test concurrency, retry behaviour, rollback, decimal precision, and date boundaries.
- [ ] Reconcile trial balance, P&L, and balance sheet against independent expected values.
- **Exit:** evidence links exist for each core accounting requirement.

## Step 4 — Stabilise product workflows
- [ ] Verify the user journeys for organisation setup, accounts, periods, journals, and reports.
- [ ] Review validation feedback, empty/error/loading states, accessibility, and responsive behaviour.
- [ ] Add end-to-end tests for the critical journeys.
- **Exit:** agreed MVP scope works consistently in a staging environment.

## Step 5 — Prepare operations
- [ ] Document real environment variables and hosting topology.
- [ ] Configure secret handling, TLS, access controls, monitoring, alerts, backups, and recovery.
- [ ] Perform a restore exercise and record RPO/RTO evidence.
- [ ] Test migration and rollback/forward-recovery procedure.
- **Exit:** operational checklist passes with evidence.

## Step 6 — Controlled pilot
- [ ] Document product limitations, onboarding, support contacts, and incident process.
- [ ] Use synthetic or approved pilot data and restrict access.
- [ ] Review feedback, defects, metrics, and risks before expanding access.
- **Exit:** product owner records a launch decision and residual-risk acceptance.

## Work item standard
Every task must include requirement IDs, owner, priority, dependencies, acceptance criteria, security/accounting impact, test evidence, documentation changes, and completion status.
