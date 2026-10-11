# Monitoring and Observability

## Objectives
Monitoring should detect service failure, suspicious access, accounting integrity issues, and degraded user experience without exposing sensitive financial or personal data.

## Signals to collect
- **Availability:** API/web health, request success/error rate, latency, database connectivity.
- **Application:** uncaught exceptions, queue/job failures if applicable, saturation and resource usage.
- **Security:** repeated authentication failures, permission denials, unusual tenant-access patterns, rate-limit events, privileged role changes.
- **Accounting:** failed posting attempts, transaction rollback rates, sequence conflicts, reconciliation failures, unexpected report discrepancies.
- **Database:** connection pool pressure, slow queries, storage, backup completion, migration status.
- **Delivery:** deployment status, build failures, version/commit, rollback events.

## Logging requirements
Use structured logs with timestamp, severity, service, environment, correlation ID, and safe event context. Never log passwords, session tokens, reset tokens, full database URLs, private keys, or unnecessary customer financial data. Restrict log access and define retention.

## Alerts
Each alert needs an owner, severity, threshold, response steps, and a test that proves the alert can fire. Avoid alerting on raw volume without a useful action. Critical security or accounting integrity alerts should have an escalation path.

## Dashboards
Maintain a service-health dashboard and a security/accounting operations dashboard. Show deployment version and time range. Avoid exposing tenant-level financial details to operators who do not need them.

## Operational reviews
Review alerts, false positives, incidents, backup status, capacity, and unresolved risks on a defined cadence. Record any monitoring gap in the risk register. Confirm actual monitoring tools and alert routes before launch.
