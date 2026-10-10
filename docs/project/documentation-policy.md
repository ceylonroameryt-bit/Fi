# Documentation Policy

## Source of truth
Documentation in this repository is version controlled alongside code. When documentation and implementation disagree, investigate and correct the mismatch; do not assume either is automatically right.

## Change-to-document map
| Change | Documentation to review |
|---|---|
| New/changed user workflow | Product requirements, user stories, API contract, roadmap/backlog |
| Accounting calculation or state transition | Accounting principles, journal lifecycle, tests and evidence |
| Schema or migration | Data model, migration notes, operational recovery steps |
| Authentication, role, tenant guard, or sensitive data | Access control, threat model, privacy notes, security tests |
| New endpoint or response change | API specification, permission matrix, integration tests |
| Report/export change | Report requirements, accounting rules, export safety tests |
| Deployment or infrastructure change | System overview, environment config, deployment runbook, recovery plan |
| Incident or major defect | Risk register, incident record, relevant tests and runbooks |

## Standard workflow
1. Clarify the requirement and acceptance criteria.
2. Inspect the existing code and related tests before changing anything.
3. Record a decision when the change has meaningful trade-offs.
4. Implement the smallest coherent change.
5. Run relevant checks and record actual results.
6. Update documentation in the same change set.
7. Review security, tenant scope, accounting correctness, failure handling, and migration impact.
8. Close the task only when acceptance evidence is linked.

## AI-assisted development rules
When using an AI coding assistant, require it to inspect the relevant files first, list intended changes, avoid unrelated refactors, never invent test results, keep secrets out of prompts and output, update documentation, and report exactly which checks ran and which did not. Human review remains required for financial, security, privacy, and deployment decisions.

## Writing rules
Prefer concise, actionable instructions. Label assumptions and unverified claims. Keep commands copyable. Never include real passwords, tokens, private keys, customer records, or production connection strings.
