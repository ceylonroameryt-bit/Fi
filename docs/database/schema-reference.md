# Database Schema Reference

## Scope and authority
This is a domain-oriented index, not a generated description of the current Prisma schema. The Prisma schema and migration history are authoritative. Update this document after inspecting them; do not assume the conceptual entities below match exact model names.

## Concepts to verify
| Concept | Questions to answer from schema |
|---|---|
| User and session | How are credentials, expiry, revocation, and user state represented? |
| Organisation | Which fields define tenant identity, currency, locale, and lifecycle? |
| Membership | What uniquely identifies membership, and how are roles stored? |
| Account | Is account code unique per organisation? How are type, status, and control-account rules represented? |
| Financial year and period | How are date ranges, states, and non-overlap rules enforced? |
| Journal entry | How are status, date, reference, sequence, creator, and posting metadata represented? |
| Journal line | How are debit/credit precision and account/tenant relations constrained? |
| Audit log | Are actor, action, target, timestamp, and metadata captured? Can ordinary runtime code update/delete rows? |
| Sales/purchase documents | How are document state, totals, tax, currency, and generated journals linked? |
| Idempotency/concurrency | Which unique constraints or state guards prevent duplicate financial effects? |

## For each model, document
- Exact model and table names.
- Primary key and unique constraints.
- Foreign keys and tenant-scope strategy.
- Nullable fields and defaults.
- Decimal precision and scale.
- Indexes supporting common filters.
- Delete/update behaviour.
- Sensitive fields and retention implications.
- Related migrations and tests.

## Schema change review
Use the migration policy and inspect generated SQL. A schema that compiles is not necessarily safe for tenant isolation, financial integrity, or production data migration.
