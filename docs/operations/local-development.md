# Local Development

## Prerequisites
The root package manifest specifies Node.js 20 or newer and npm workspaces. Use the repository lockfile and a supported PostgreSQL setup. The README describes an embedded PostgreSQL helper, but verify it works on the current operating system before relying on it.

## Setup
From the repository root:

```bash
npm ci
npm run db:start
npm run db:migrate --workspace apps/api
npm run db:seed --workspace apps/api
npm run dev
```

The root scripts define API and web development commands. The README documents the API at http://localhost:4000/api/v1 and web app at http://localhost:3000. Confirm ports and environment configuration in the current code.

## Common checks
```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

The root scripts run API and web checks, but inspect script definitions before using them as release gates. E2E tests may require a running database and a test-specific environment.

## Local safety
- Never point local destructive/reset commands at a production database.
- Use synthetic data only.
- Keep local environment files out of version control.
- Do not paste tokens, credentials, customer data, or database URLs into issues or logs.
- Before changing the schema, inspect existing migrations and back up any local data worth preserving.
- If setup fails, record OS, Node/npm versions, exact command, and redacted error output in the task.
