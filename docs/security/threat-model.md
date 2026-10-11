# Threat Model

## Assets
Financial records, customer and supplier information, user credentials and sessions, organisation membership, audit history, database credentials, cloud credentials, backups, and deployment pipelines.

## Trust boundaries
- Browser to web frontend.
- Frontend to API.
- API to database.
- One organisation's records to another organisation's records.
- Application runtime to cloud services and object storage.
- Developer workstation and CI pipeline to production environments.
- Production data to logs, exports, backups, and support tooling.

## Threats and controls to verify
| Threat | Example | Required controls |
|---|---|---|
| Broken tenant isolation | User changes an organisation or record ID to access another tenant. | Server-side membership checks, tenant-scoped queries, composite relations, negative tests on every resource family. |
| Broken access control | Viewer invokes a write endpoint directly. | Permission guards, deny-by-default rules, route matrix, negative API tests. |
| Credential compromise | Leaked token or weak password reset flow. | Secure hashing, expiry, revocation, rate limiting, safe reset-token storage, secret-free logs. |
| Duplicate financial effect | Retried or concurrent posting creates two ledger effects. | Atomic state transition, transaction isolation/concurrency control, idempotency, concurrency tests. |
| Audit tampering | Application or database role modifies history. | Least privilege, append-only controls, restricted DB roles, monitored privileged access, restoration tests. |
| Injection and unsafe exports | Malicious values reach queries or CSV consumers. | Parameterised access, DTO validation, output encoding, CSV formula-injection defence. |
| Supply-chain compromise | Vulnerable or malicious dependency. | Lockfile review, automated dependency scanning, controlled updates, CI checks. |
| Secret exposure | Credentials committed or printed in logs. | Secret manager, scanning, redaction, rotation and incident procedure. |
| Data loss | Accidental deletion, corruption, or compromised account. | Encrypted backups, restricted access, retention, periodic restore exercises. |
| Service abuse | Brute force or request flooding. | Rate limits, quotas, monitoring, alerting, abuse-response process. |

## Review cadence
Review the threat model for new financial workflows, authentication changes, new integrations, data export/import, deployment changes, and before public launch. Record findings and owners in the risk register.

## Incident response
Contain access, preserve evidence, rotate affected credentials, assess data exposure and integrity, restore safely where required, notify relevant stakeholders and authorities when legally required, and document lessons learned. Obtain qualified legal/privacy advice for reportability and deadlines.
