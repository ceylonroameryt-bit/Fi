# Product Requirements and Acceptance Criteria

Use stable IDs in issues, commits, tests, and release notes. Statuses below are requirements, not claims that each has been fully verified.

## Accounting
| ID | Requirement | Acceptance evidence |
|---|---|---|
| ACC-001 | Journal debits equal journal credits before validation/posting. | Tests reject imbalance and accept exact balance using decimal arithmetic. |
| ACC-002 | A journal contains at least two valid lines. | Empty and single-line cases fail with a stable domain error. |
| ACC-003 | Amounts cannot be negative; each line must have one positive side only. | Tests cover negative values, both sides populated, and both sides zero. |
| ACC-004 | Journal accounts belong to the selected organisation and are eligible for manual posting. | Cross-tenant, archived, and control-account cases are rejected. |
| ACC-005 | Journal dates resolve to an organisation's accounting period; hard-locked periods reject changes. | Boundary-date and locked-period tests. |
| ACC-006 | Posted entries are not silently edited or deleted; corrections use an auditable reversal/correction workflow. | Integration tests verify immutable posted records and correct reversal effects. |
| ACC-007 | Sequence numbers remain unique under concurrent requests. | Concurrency test with multiple simultaneous journal creations. |
| ACC-008 | Trial balance and financial statements reconcile to the same posted-ledger source. | Reconciliation fixtures and invariant tests. |
| ACC-009 | Money calculations avoid binary floating-point arithmetic. | Decimal-specific tests for rounding, scale, and edge cases. |

## Identity, tenancy, and authorisation
| ID | Requirement | Acceptance evidence |
|---|---|---|
| SEC-001 | Every protected request authenticates a valid user/session. | Missing, invalid, expired, and revoked credential tests. |
| SEC-002 | Every tenant-scoped read/write verifies organisation membership and permission server-side. | Cross-tenant tests for every resource family, not only one endpoint. |
| SEC-003 | Role permissions follow the access-control matrix. | Positive and negative tests for each role and protected action. |
| SEC-004 | Passwords and reset/verification tokens are stored and handled safely. | Code review and tests; no raw passwords or reusable tokens in logs. |
| SEC-005 | Sensitive configuration and credentials are not committed to source control. | Secret scanning and deployment configuration review. |
| SEC-006 | Security-sensitive actions create protected audit records. | Tests for audit creation and database-level tamper resistance. |

## Data and reporting
| ID | Requirement | Acceptance evidence |
|---|---|---|
| DB-001 | Database constraints protect core uniqueness, tenant relations, date ranges, and financial amount invariants. | Migration review and database integration tests. |
| REP-001 | Each report identifies organisation, currency, period/date basis, and relevant filters. | Contract and UI tests. |
| REP-002 | Report totals can be reconciled to posted journal lines. | Known-ledger fixtures with expected totals. |
| REP-003 | CSV exports escape special characters and resist spreadsheet formula injection. | Export tests with commas, quotes, newlines, and formula-prefixed values. |

## Operations and privacy
| ID | Requirement | Acceptance evidence |
|---|---|---|
| OPS-001 | A new developer can follow documented setup instructions from a clean checkout. | Setup walkthrough recorded against supported operating systems. |
| OPS-002 | Production deployments use managed secrets, TLS, access controls, backups, and monitoring. | Deployment review and environment-specific evidence. |
| OPS-003 | Backup restoration is tested and recovery objectives are documented. | Dated restore exercise with measured recovery time/data loss. |
| PRIV-001 | Personal data collection, purpose, retention, access, deletion, and incident handling are documented. | Data inventory and privacy review; obtain specialist advice where needed. |

## Definition of done
A requirement is complete only when the implementation exists, acceptance tests pass, security/accounting implications have been reviewed, documentation is updated, and the evidence is linked from the task. A passing unit test alone does not prove production readiness.
