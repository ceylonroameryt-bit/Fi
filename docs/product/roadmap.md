# Delivery Roadmap

This is a proposed sequence, not a claim that the phases are complete. Prioritise correctness and risk reduction over adding features.

| Phase | Focus | Exit criteria |
|---|---|---|
| 0. Baseline audit | Map source, schema, routes, workflows, tests, deployment, and known gaps. | Inventory reviewed; claims in README checked; highest risks assigned. |
| 1. Platform integrity | Build, typecheck, lint, configuration, migrations, health checks, reproducible setup. | Clean-checkout setup and CI gates pass. |
| 2. Identity and tenancy | Authentication/session lifecycle, membership guards, permission matrix, tenant-scoped queries. | Route-by-route negative tenant and role tests pass. |
| 3. Accounting engine | Decimal rules, journal lifecycle, sequence concurrency, posting atomicity, reversals, period locks. | Accounting invariants and failure/rollback tests pass. |
| 4. Ledger and reports | General ledger, trial balance, P&L, balance sheet, exports. | All reports reconcile against independently calculated fixtures. |
| 5. Sales and purchases | Document lifecycle, tax/account mapping, posting, corrections, and links to ledger. | End-to-end workflow and accounting review completed. |
| 6. Product usability | Empty/loading/error states, accessibility, responsive layout, validation feedback. | Critical journeys tested on supported viewports and keyboard navigation. |
| 7. Security and privacy | Threat model, dependency review, secret handling, data inventory, retention, incident response. | No unresolved release-blocking findings; mitigations documented. |
| 8. Deployment and recovery | CI/CD, staging, production config, monitoring, backups, restoration, rollback. | Successful staging release and witnessed restore exercise. |
| 9. Controlled launch | Pilot users, support process, known limitations, feedback, release criteria. | Product owner approves launch with risks and evidence recorded. |

## Planning rules
- Break phases into small, testable issues.
- Estimate only after inspecting the actual work.
- A phase is not done because its UI exists; require backend, database, permissions, tests, documentation, and operational evidence as applicable.
- Revisit the roadmap after each baseline audit and release.
