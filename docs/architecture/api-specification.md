# API Conventions

## Base path
The repository README documents the API prefix as /api/v1 and local API port as 4000. Confirm environment-specific URLs in configuration before release.

## Contract conventions
- Use explicit request and response DTOs; validate untrusted input at the API boundary.
- Use consistent status codes and a stable domain-error format.
- Never trust organisation IDs supplied by the client without verifying membership and access.
- Apply authentication and permission checks server-side to every protected operation.
- Paginate collection endpoints and set reasonable maximum page sizes.
- Use explicit date formats and time-zone semantics; do not silently reinterpret dates.
- Return monetary values in a stable decimal representation, preferably strings in JSON where numeric precision could be lost.
- Avoid exposing stack traces, internal SQL, tokens, or sensitive data in error responses.
- Use request correlation IDs for observability without allowing user input to forge trusted tracing context.

## Idempotency and concurrency
Operations that create financial effects must define retry behaviour. Posting and other state transitions should prevent duplicate effects under retries and concurrent requests. Consider an idempotency key where client retries can repeat a non-idempotent operation; persist and validate the key scope and outcome.

## Documenting endpoints
For each endpoint record: purpose, authentication, required permission, tenant scope, request schema, response schema, status/error codes, side effects, idempotency behaviour, audit event, and tests. Keep a generated OpenAPI specification or an equivalent checked-in API contract aligned with the implementation.
