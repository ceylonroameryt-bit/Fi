# Security and Data Incident Response

This is an operational template. Adapt it to the actual hosting provider, legal obligations, support arrangements, and team availability before production launch.

## Severity guide
- **SEV-1:** suspected active compromise, cross-tenant data exposure, credential theft with material access, or accounting data integrity loss.
- **SEV-2:** significant security weakness or service disruption with contained impact.
- **SEV-3:** limited issue with no current evidence of material exposure or integrity loss.

Escalate severity when evidence is incomplete and potential impact is high.

## Response sequence
1. **Recognise and record:** open an incident record with time, reporter, systems, observed facts, and severity. Preserve relevant logs.
2. **Contain:** revoke sessions or credentials, restrict access, disable affected endpoints/jobs, or stop financial writes if integrity is uncertain. Avoid destructive actions that erase evidence.
3. **Assess:** establish affected tenants, data types, time window, entry point, persistence, and whether records were read or changed.
4. **Eradicate:** fix the cause, rotate affected secrets, remove unauthorised access, and patch compromised components.
5. **Recover:** restore from a trusted point if needed, verify ledger and database integrity, validate access controls, and monitor closely.
6. **Communicate:** notify internal stakeholders and affected parties through an approved channel. Obtain qualified legal/privacy advice on notification duties and deadlines.
7. **Learn:** complete a timeline, root-cause analysis, corrective actions, and updates to tests, threat model, runbooks, and risk register.

## Financial integrity incidents
If journal posting or ledger integrity is uncertain, pause affected writes, preserve database state and audit evidence, reconcile entries against backups/logs, and require authorised review before resuming. Never repair production balances by ad hoc SQL without a recorded, reviewed recovery plan.

## Incident record template
- Incident ID and severity:
- Date/time discovered and time zone:
- Reporter and incident lead:
- Affected services/tenants/data:
- Timeline and evidence locations:
- Containment actions:
- Credential rotations:
- Integrity and scope assessment:
- Communications and notifications:
- Recovery validation:
- Root cause:
- Corrective actions, owners, due dates:
- Closure approval:

## Readiness
Before launch, assign primary and backup incident contacts, define out-of-hours escalation, verify log access, and run a tabletop exercise.
