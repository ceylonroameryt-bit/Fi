# Test Strategy

## Test layers
1. **Unit tests:** money arithmetic, date boundaries, domain validation, state transitions, report calculations.
2. **Database integration tests:** constraints, migrations, transaction rollback, uniqueness, append-only audit controls, tenant relations.
3. **API integration/E2E tests:** authentication, role permissions, tenant isolation, complete accounting workflows.
4. **Frontend tests:** validation feedback, error/loading/empty states, navigation, report filters and exports.
5. **Security tests:** unauthorised access, cross-tenant ID manipulation, session revocation, rate limiting, secret exposure, unsafe exports.
6. **Operational tests:** clean setup, migration, backup/restore, health checks, rollback and deployment verification.

## Essential accounting fixtures
Create small independently calculated ledgers that cover:
- balanced and unbalanced journals;
- debit/credit normal balances and contra accounts;
- period boundaries and locked periods;
- posting and reversal;
- opening balances and year-end treatment;
- invoices, purchases, tax/VAT cases where supported;
- trial balance, profit and loss, and balance sheet reconciliation;
- decimal precision, rounding, large values, and zero values.

## Release gates
- Install from a clean checkout using the lockfile.
- Run formatting/lint, API and web typechecks, unit tests, E2E tests, and production builds.
- Review migrations and generated SQL.
- Ensure no known critical/high security or accounting defect remains without explicit risk acceptance.
- Confirm demo credentials and sample data are safe for the target environment.
- Verify logs, health checks, secrets, backups, restore procedure, rollback, and monitoring.
- Record command, environment, date, result, and relevant logs for each check.

## Evidence discipline
The README currently states test counts and build results. Treat those as historical repository claims until rerun on the current commit. Do not mark a test as passing without current execution evidence. A green build does not establish accounting correctness or security.
