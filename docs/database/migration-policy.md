# Database Migration Policy

## Principles
- Every schema change is versioned through the repository's migration mechanism.
- Never edit an already-applied production migration to change history; create a new migration.
- Review generated SQL, constraints, indexes, lock implications, data transformations, and tenant scope.
- Prefer backward-compatible expand/migrate/contract changes for rolling deployments.
- Do not run destructive reset or seed commands against production.
- Keep schema, generated Prisma Client, application code, and documentation aligned.

## Before a migration
1. State the purpose and affected tables/fields.
2. Identify existing-data assumptions and invalid rows.
3. Estimate table size, lock time, index build impact, and downtime risk.
4. Design a safe backfill and validation query where required.
5. Define rollback or forward-recovery steps.
6. Test from an empty database and a representative previous schema.
7. Verify tenant relations and accounting invariants after migration.

## Deployment
- Back up and confirm restore capability before high-risk changes.
- Use the documented production migration command and a least-privilege migration identity.
- Deploy code in an order compatible with the old/new schema where rolling deployment is possible.
- Monitor errors, locks, query performance, and integrity checks.
- Record migration version, operator, environment, start/end times, and result.

## Failure handling
Do not blindly retry a partially completed migration or manually delete migration metadata. Inspect database state, migration history, and logs, then follow the reviewed recovery plan. Prefer a corrective migration when rollback could lose data.

## Acceptance evidence
Link migration tests, generated SQL review, representative data tests, deployment notes, and recovery plan to the pull request.
