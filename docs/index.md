# Blynt Project Documentation

This directory is the working source of truth for product intent, architecture, accounting rules, security, delivery, and operational procedures.

## Start here
- [Product vision](product/vision.md)
- [Requirements and acceptance criteria](product/requirements.md)
- [User stories](product/user-stories.md)
- [Roadmap](product/roadmap.md)
- [System overview](architecture/system-overview.md)
- [Data model principles](architecture/data-model.md)
- [API conventions](architecture/api-specification.md)
- [Accounting principles](accounting/accounting-principles.md)
- [Journal lifecycle](accounting/journal-lifecycle.md)
- [Threat model](security/threat-model.md)
- [Access control](security/access-control.md)
- [Test strategy](testing/test-strategy.md)
- [Local development](operations/local-development.md)
- [Deployment runbook](operations/deployment-runbook.md)
- [Task backlog](project/task-backlog.md)
- [Risk register](project/risk-register.md)
- [Decision log](project/decision-log.md)
- [Release checklist](project/release-checklist.md)
- [Documentation policy](project/documentation-policy.md)

## Status and evidence
These documents describe the intended product and the implementation reported in the repository README and package manifests. They are not a substitute for inspecting the current source code, running the test suites, reviewing deployment configuration, or obtaining professional accounting, tax, security, and legal advice. Any capability without fresh implementation and test evidence must be treated as **unverified**.

## Project identity
The repository README and package manifests currently identify the product as **Blynt**. Use Blynt as the working product name unless the product owner records a decision to rename it. The repository URL remains https://github.com/ceylonroameryt-bit/Fi.

## How to maintain these docs
For every meaningful change: update requirements or user stories when scope changes; update architecture/accounting/security docs when invariants change; add test evidence; record consequential decisions and risks; and revise release checklists when deployment or operations change.
