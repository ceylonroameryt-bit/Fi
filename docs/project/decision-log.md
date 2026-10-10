# Decision Log

Record consequential product and technical decisions here. For substantial architecture decisions, create an ADR with context, options, decision, consequences, and revisit criteria.

| ID | Decision / assumption | Status | Rationale or follow-up |
|---|---|---|---|
| DEC-001 | Use Blynt as the working product name. | Working decision | README and root/API/web package manifests use Blynt. Change only through a recorded product-owner decision and consistent repo update. |
| DEC-002 | Use a TypeScript monorepo with NestJS API and Next.js web app. | Existing repository direction | Confirm against package manifests; avoid splitting services without a documented need. |
| DEC-003 | Use PostgreSQL and Prisma for persistent data access. | Existing repository direction | Review migrations and database constraints as part of each schema change. |
| DEC-004 | Use decimal-safe arithmetic for monetary calculations. | Required invariant | Verify all arithmetic paths, serialization, rounding, and report calculations. |
| DEC-005 | Treat tenant isolation, auditability, and accounting correctness as release-blocking controls. | Product/engineering principle | Must be supported by automated tests and operational evidence. |
| DEC-006 | AWS is a candidate, not a final hosting decision. | Open | Compare cost, data residency, reliability, operational burden, and recovery needs before selection. |
| DEC-007 | UK tax/MTD compliance is not claimed by this documentation. | Open scope item | Determine applicability and obtain qualified review before making compliance claims. |

Append decisions rather than silently rewriting history. If a decision changes, record the replacement, date, reason, migration implications, and links to affected code/docs.
