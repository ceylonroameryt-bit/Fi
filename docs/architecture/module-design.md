# Module Design

This document describes intended boundaries. Confirm module names and dependencies against the current source tree before treating this as a code map.

## Backend responsibilities
- **Identity and sessions:** authentication, session lifecycle, credential recovery, and account state.
- **Organisations and membership:** organisation lifecycle, user membership, active organisation context, and tenant scope.
- **Authorisation:** central permission definitions, role mapping, guards, and policy checks.
- **Chart of accounts:** account creation, account code/type validation, archive rules, and control-account restrictions.
- **Financial periods:** financial years, accounting periods, date boundaries, and lock transitions.
- **Journals:** draft lifecycle, validation, sequence allocation, posting, reversal, and audit events.
- **Sales and purchases:** commercial documents and their accounting impact where implemented.
- **Ledger and reporting:** posted-ledger queries, trial balance, P&L, balance sheet, and exports.
- **Audit and observability:** durable business audit records and operational logs.

## Dependency direction
Transport controllers should call application/domain services. Domain rules should not depend on web UI code. Persistence adapters should implement data access while domain services own the decisions that affect accounting state. Avoid circular module dependencies.

## Cross-cutting requirements
- Tenant scope and permissions are explicit inputs to protected operations.
- Financial state transitions use transactions and concurrency controls.
- Domain errors are stable and safe to return to clients.
- Logs are structured and redact credentials and sensitive values.
- External integrations, if introduced, use explicit adapters and bounded credentials.

## Module review template
For each module, document: purpose, owned entities, public service methods, dependencies, authorisation rules, transactions, emitted audit events, failure modes, tests, and operational signals. Update this document after source inspection confirms actual module boundaries.
