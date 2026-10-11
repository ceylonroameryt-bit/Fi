# Risk Register

Review at least before each release and whenever a material architecture or accounting workflow changes.

| ID | Risk | Initial priority | Mitigation / evidence required | Status |
|---|---|---|---|---|
| R-001 | Cross-tenant access exposes one organisation's financial data to another. | Critical | Route-by-route membership checks, composite tenant constraints, negative E2E tests. | Open — verify |
| R-002 | Retried or concurrent posting creates duplicate ledger effects. | Critical | Atomic transaction, state guard, idempotency/concurrency control, stress tests. | Open — verify |
| R-003 | Posted entries can be changed without traceable correction. | Critical | Immutability controls, reversal workflow, database and service tests. | Open — verify |
| R-004 | Reports disagree with ledger data or omit relevant entries. | High | Independent accounting fixtures and reconciliation assertions. | Open — verify |
| R-005 | Seeded demo credentials are accessible in a public environment. | High | Environment-gated seed, disable default accounts in production, rotate exposed secrets. | Open — verify |
| R-006 | Backup exists but cannot be restored within acceptable time. | High | Restore drills, measured recovery point/time, protected backup access. | Open — verify |
| R-007 | Regulatory/tax claims exceed actual product capability. | High | Define scope, review HMRC/MTD obligations with qualified specialists, avoid unsupported claims. | Open — verify |
| R-008 | Personal or financial data appears in logs, exports, or support artefacts. | High | Data minimisation, redaction, access controls, export tests, retention policy. | Open — verify |
| R-009 | Dependencies or CI secrets are compromised. | High | Dependency/secret scanning, least-privilege CI, controlled releases and rotation. | Open — verify |
| R-010 | Product naming and documentation are inconsistent. | Medium | Use Blynt as working name; record and implement any rename through an ADR. | Open |

Priority is an initial engineering assessment, not a formal risk analysis. Add likelihood, impact, owner, due date, evidence link, residual risk, and approval when each item is actively triaged.
