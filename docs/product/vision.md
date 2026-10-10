# Product Vision

## Purpose
Blynt is a UK-focused cloud accounting product intended to help small businesses keep organised financial records and understand their financial position. The product should make routine bookkeeping clear while protecting the integrity and confidentiality of financial data.

## Product principles
1. **Correctness before convenience.** Financial totals must be traceable to source entries and use decimal-safe arithmetic.
2. **Tenant isolation by default.** Users may access only organisations and records for which they have explicit membership and permission.
3. **Traceability.** Important actions should be attributable to an actor and time, with protected audit history.
4. **Controlled financial state.** Drafts, validated entries, posted entries, reversals, and closed periods have explicit rules.
5. **Explainable reporting.** Reports should state their date range, basis, currency, and relevant filters.
6. **Secure delivery.** Security, privacy, testing, backups, and operational readiness are release requirements, not post-launch extras.
7. **Documented decisions.** Product owner decisions, assumptions, trade-offs, and evidence must remain in version control.

## Intended users
- Small-business owners who need a clear view of finances.
- Bookkeepers who prepare routine entries and maintain records.
- Accountants who review, validate, and reconcile records.
- Organisation administrators who manage membership and settings.
- Read-only stakeholders who need reports without write access.

## Initial scope
The repository describes authentication and sessions, multi-organisation membership, role-based permissions, a chart of accounts, financial years and periods, manual journals, purchases and sales workflows, and financial reports. The exact production-ready scope must be confirmed against current source code and test evidence.

## Out of scope until explicitly approved
- Claims of regulatory certification or audit assurance.
- Guaranteed HMRC Making Tax Digital compliance.
- Payroll, banking connectivity, tax filing, or payment initiation unless separately specified.
- Production readiness based solely on a successful local build.
- Treating seeded demo accounts as acceptable production identities.

## Success measures
- Accounting invariants are enforced in the service and database layers where appropriate.
- No known cross-tenant access paths remain in tested routes.
- Critical user journeys have repeatable automated tests.
- Financial reports reconcile to posted ledger data.
- Backups and restoration are tested and documented.
- Releases have a recorded owner, version, test evidence, rollback plan, and unresolved-risk review.
