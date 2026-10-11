# Secure Development Standard

## Secrets and credentials
- Keep secrets in an approved secret manager or protected environment configuration.
- Never commit API keys, database URLs with credentials, session secrets, private keys, or production tokens.
- Scan repository history and current changes; rotate any exposed credential rather than merely deleting the line.
- Use synthetic credentials and data in development and automated tests.

## Authentication and sessions
Verify password hashing parameters, login throttling, session expiry, logout/revocation, reset-token expiry and one-time use, and safe cookie settings. Do not log passwords, bearer tokens, session identifiers, or reset tokens.

## Input and output
Validate all untrusted input on the server. Use parameterised database access, safe output encoding, file upload restrictions where applicable, and export sanitisation. Avoid exposing stack traces or internal database details to clients.

## Tenant isolation and authorisation
Apply deny-by-default permissions and server-side organisation membership checks to every protected operation. Test direct API calls, modified IDs, nested resources, exports, and background jobs. Do not rely on frontend visibility.

## Dependencies and build pipeline
Use the lockfile, review dependency updates, run vulnerability and secret scans, restrict CI permissions, and protect deployment credentials. Pin or otherwise control production build inputs according to the chosen deployment model.

## Logging and privacy
Log enough to investigate failures without storing unnecessary personal or financial data. Apply redaction, access restrictions, retention, and monitoring to logs and exports.

## Required checks for security-sensitive pull requests
- Threat-model impact considered.
- Positive and negative authorisation tests added.
- Sensitive values absent from logs and errors.
- Migration and rollback implications reviewed.
- Relevant static/dependency/secret scans checked.
- Documentation and risk register updated.
