# ADR-0001: TypeScript Monorepo and Application Stack

- **Status:** Existing direction; confirmation and review pending
- **Date:** 2026-10-11
- **Decision owners:** Product owner / maintainer

## Context
The repository manifests and README describe a TypeScript monorepo with a NestJS API, Next.js web application, Prisma ORM, and PostgreSQL. A monorepo can simplify shared contracts and coordinated changes for a small team, but it requires clear package boundaries and reproducible builds.

## Decision
Continue with the current monorepo structure while it remains maintainable:
- `apps/api` for the NestJS API.
- `apps/web` for the Next.js frontend.
- PostgreSQL accessed through Prisma for persistence.
- TypeScript for application code.

This records the current repository direction, not a claim that the stack has been independently audited.

## Consequences
**Benefits:** one repository for coordinated changes; shared tooling; simpler local development and review.

**Costs:** package scripts and dependency boundaries need discipline; builds may become slower as the repository grows; shared changes can couple releases.

## Revisit when
Build times or deployment coupling become material, package boundaries repeatedly fail, or scaling requirements justify a different structure.

## Follow-up
Confirm package boundaries, workspace scripts, lockfile behaviour, supported Node version, migration flow, and CI build strategy against the actual repository.
