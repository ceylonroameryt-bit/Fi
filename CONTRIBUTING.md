# Contributing to Blynt

Thank you for helping improve Blynt. This guide applies to code, tests, infrastructure, and documentation changes.

## Before starting
1. Read [the documentation index](docs/index.md), the relevant domain documents, and open issues.
2. For a substantial change, agree the scope and acceptance criteria in a GitHub issue before implementation.
3. Check whether the change affects accounting rules, tenant isolation, permissions, schema, privacy, or deployment.
4. Never include secrets, customer data, production identifiers, or real financial records in issues, tests, screenshots, or commits.

## Development workflow
1. Create a focused branch from the agreed base.
2. Inspect existing implementation and tests before editing.
3. Make the smallest coherent change; avoid unrelated refactors.
4. Add or update tests for expected behaviour, negative cases, and failure paths.
5. Run relevant checks from a clean or reproducible environment.
6. Update the corresponding documentation in the same change.
7. Open a pull request with purpose, scope, tests run, results, risks, migrations, and rollback notes.

## High-risk changes
Changes to journal posting, reversals, tenant scoping, access control, session handling, monetary arithmetic, reporting, or migrations require explicit review of their security/accounting implications. Do not merge solely because a build passes.

## Pull request checklist
- [ ] Scope and acceptance criteria are clear.
- [ ] No unrelated changes are included.
- [ ] Tests cover success, failure, permissions, and boundary cases as appropriate.
- [ ] Lint, typecheck, tests, and build results are reported accurately.
- [ ] Database migrations and operational effects are described.
- [ ] Documentation is updated.
- [ ] No secrets or personal/financial data are included.
- [ ] Remaining risks and untested areas are disclosed.

## Commit messages
Use concise, action-oriented messages, for example:
- `feat(accounting): add journal reversal`
- `fix(auth): reject expired sessions`
- `test(ledger): cover concurrent posting`
- `docs(operations): clarify restore procedure`

## Review and merge
Reviewers should assess correctness, maintainability, security, accessibility where relevant, observability, and documentation. Require appropriate checks before merging. A reviewer must not mark a requirement complete without evidence.
