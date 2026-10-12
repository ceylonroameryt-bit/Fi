# 07. REST API Specification & Contract Reference

**API Base URL:** `http://localhost:4000/api/v1` (Production: `https://api.blynt.co.uk/api/v1`)  
**Data Exchange Format:** JSON (`application/json; charset=utf-8`)  
**Security Standard:** Bearer Token via HTTP Header `Authorization: Bearer <token>`  
**Correlation Tracking:** Unique `x-request-id` header generated on every incoming request  

---

## 1. Global Architectural Standards

### 1.1 Standard Domain Error Response Envelope
Every non-2xx error returns a standardized JSON envelope matching `DomainException`:

```json
{
  "statusCode": 400,
  "errorCode": "ERR_JOURNAL_UNBALANCED",
  "message": "Total debits (£1,000.0000) must equal total credits (£950.0000). Imbalance: £50.0000",
  "details": {
    "totalDebits": "1000.0000",
    "totalCredits": "950.0000",
    "difference": "50.0000"
  },
  "timestamp": "2026-10-11T23:30:00.000Z",
  "path": "/api/v1/journals/clx49817203/validate",
  "requestId": "req_847291048291"
}
```

### 1.2 Domain Error Catalog (Authoritative Codes)

| Error Code | HTTP Status | Meaning |
| :--- | :---: | :--- |
| `ERR_AUTH_INVALID_CREDENTIALS` | 401 | Email or password incorrect. |
| `ERR_AUTH_SESSION_EXPIRED` | 401 | Bearer token revoked or expired. |
| `ERR_AUTH_FORBIDDEN` | 403 | User role lacks permission for this endpoint. |
| `ERR_JOURNAL_UNBALANCED` | 400 | Debits do not equal credits down to 4 decimal places. |
| `ERR_JOURNAL_MINIMUM_LINES` | 400 | Journal must have at least 2 distinct lines. |
| `ERR_CONTROL_ACCOUNT_DIRECT_POSTING` | 400 | Manual entry to protected control accounts is forbidden. |
| `ERR_PERIOD_NOT_FOUND` | 404 | Transaction date does not resolve to an accounting period. |
| `ERR_PERIOD_HARD_LOCKED` | 403 | Period has been permanently locked for statutory filing. |
| `ERR_ORGANIZATION_SUSPENDED` | 403 | Target company workspace is suspended or archived. |
| `ERR_TENANT_VIOLATION` | 403 | Attempted cross-tenant reference detected. |

---

## 2. API Endpoints by Domain

### 2.1 Authentication Endpoints (`/auth`)
* `POST /auth/register`: Create user account, hashed with `scrypt`, and provisions demo organisation.
* `POST /auth/login`: Validates credentials with constant-time equality check; returns session token.
  * *Request Body:* `{"email": "accountant@company.com", "password": "Password1234!"}`
  * *Response 200:* `{"accessToken": "sess_tok_92819...", "user": {...}, "organizations": [...]}`
* `POST /auth/logout`: Revokes active session token.
* `GET /auth/sessions`: Returns list of active user sessions with IP, user-agent, and login timestamps.

### 2.2 Organizations Endpoints (`/organizations`)
* `GET /organizations`: Lists all workspaces the current user has access to.
* `POST /organizations`: Provisions a new company workspace with seeded UK Chart of Accounts.
* `GET /organizations/:id`: Retrieves legal name, company number, and VAT settings.
* `PATCH /organizations/:id`: Updates company metadata.

### 2.3 Chart of Accounts Endpoints (`/accounts`)
* `GET /accounts`: Retrieves nominal ledger accounts (supports filtering by `type=ASSET` or `status=ACTIVE`).
* `POST /accounts`: Adds a custom nominal account.
  * *Request Body:* `{"code": "5050", "name": "Cloud Hosting Fees", "type": "EXPENSE", "subtype": "OPERATING_EXPENSE"}`
* `POST /accounts/:id/archive`: Archives an account.

### 2.4 Accounting Periods Endpoints (`/financial-years`, `/accounting-periods`)
* `GET /financial-years`: Lists financial years and calendar dates.
* `POST /financial-years`: Automatically generates a financial year and 12 monthly periods.
* `PATCH /accounting-periods/:id/lock`: Updates lock state (`OPEN`, `SOFT_LOCKED`, `HARD_LOCKED`).

### 2.5 Journals Endpoints (`/journals`)
* `GET /journals`: Returns paginated journal entries with status filtering.
* `POST /journals`: Creates a draft journal entry.
  * *Request Body:*
    ```json
    {
      "entryDate": "2026-10-15",
      "description": "Monthly Software Depreciation",
      "lines": [
        { "accountId": "acc_6500", "debit": "500.0000", "credit": "0.0000", "description": "Depreciation expense" },
        { "accountId": "acc_1810", "debit": "0.0000", "credit": "500.0000", "description": "Accumulated depreciation" }
      ]
    }
    ```
* `POST /journals/:id/validate`: Runs the 15-rule validation engine and transitions status to `VALIDATED`.
* `POST /journals/:id/reverse`: Generates a GAAP counter-balancing reversal journal.

### 2.6 Contacts & Subledger Endpoints (`/contacts`)
* `GET /contacts`: Lists customers and suppliers with real-time derived balance metrics.
* `POST /contacts`: Creates customer or supplier record with UK VAT number and payment terms.
* `GET /contacts/:id/statement`: Returns chronological statement with running line balances.

### 2.7 Sales Invoicing Endpoints (`/invoices`)
* `POST /invoices`: Creates draft sales invoice with item lines and UK VAT rate (20%, 5%, 0%).
* `POST /invoices/:id/post`: Approves invoice and auto-generates balanced double-entry GL journal.
