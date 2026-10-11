# Environment Configuration

## Policy
Environment-specific values belong in the deployment platform's protected configuration or an approved secret manager. Commit only safe examples and variable names, never real values.

## Configuration inventory
Build the definitive inventory from the current source code and deployment settings. For each variable, record its consumer, required/optional status, environment, secret classification, safe example, validation behaviour, and rotation procedure.

| Category | Examples of values to inventory | Handling |
|---|---|---|
| Database | Connection URL, pool limits | Secret; restrict network and database privileges. |
| Authentication | Session/JWT secrets, cookie settings, token expiry | Secret values must be high entropy and rotated after exposure. |
| Web/API | API base URL, public site URL, allowed origins | Validate per environment; do not use wildcard CORS with credentials. |
| Email/notifications | Provider credentials, sender identity | Secret provider key; test using non-production recipients. |
| Observability | Error-reporting DSN, log/metric credentials | Restrict access; scrub sensitive payloads. |
| Cloud/storage | Role/identity, bucket/container names | Prefer workload identity/short-lived credentials over static keys. |
| Runtime | Port, log level, environment name | Validate on startup; production should not use debug logging. |

## Environment separation
- Keep development, test, staging, and production databases separate.
- Use least-privilege identities per environment.
- Never use production customer data in development without an approved, privacy-safe process.
- Ensure migrations and seed scripts cannot accidentally target production.
- Validate required variables at startup and fail safely if absent.
- Do not print secrets in startup logs or error messages.

## Rotation
Document how to rotate each secret, revoke old credentials, restart/redeploy affected services, verify success, and investigate potential exposure. Secret rotation does not replace assessment of whether data or access was compromised.
