# Blynt – AI-first supplier bill workflow: plan

Status as of 2026-10-15. Baseline: `apps/api` unit suite 26 suites / 127 tests passing. E2E suite (`npm run test:e2e`) needs Postgres and was not run for this analysis.

## a) Stack and architecture

Monorepo (npm workspaces): `apps/api` (NestJS 11 + Prisma 6 + PostgreSQL, Jest), `apps/web` (Next.js app router). Money is `Prisma.Decimal` via `MoneyService`.

| Area | Location |
|---|---|
| Auth (JWT access + refresh cookies, sessions, password reset, invitations) | `apps/api/src/auth/` (`auth.service.ts`, `token.service.ts`, `auth.guard.ts`); models `User`, `Session`, `UserToken` |
| Rate limiting | `@nestjs/throttler` global guard in `src/app.module.ts`; per-route `@Throttle` in `auth.controller.ts` |
| Organisations / members | `src/organizations/`, `src/organization-members/`; `Organization` has `name`, `legalName`, `registrationNumber`, `taxNumber` |
| Permissions / roles | `src/roles/roles.constants.ts` (`SYSTEM_PERMISSIONS`), `src/common/guards/organization-access.guard.ts` |
| Chart of accounts | `src/accounts/` |
| Financial years / periods | `src/financial-years/`, `src/accounting-periods/` |
| Journals (draft CRUD) | `src/journals/` |
| Validation | `src/accounting-engine/journal-validation.service.ts` |
| Posting engine | `src/accounting-engine/journal-posting.service.ts` |
| Reversals | `src/accounting-engine/journal-reversal.service.ts` |
| Money / rounding | `src/accounting-engine/money.service.ts` (`round()`) |
| Ledger | `src/ledger/general-ledger.service.ts` |
| Reports (TB, P&L, BS) | `src/reports/` |
| Audit | `src/audit/` (`AuditLog`), plus `AiAuditEvent` |
| Contacts + subledger | `src/contacts/` |
| Sales invoices | `src/invoices/` (`Invoice`, `InvoiceLine`) |
| Storage | `src/common/storage/` (local + S3 providers) |
| AI prototype | `src/ai/` – `document-intelligence/*`, `providers/heuristic-llm.provider.ts` (regex "LLM"), `guardrails/`, `business-context/`, `feedback/`, `audit/`; migration `20261008203000_document_intelligence_and_ai_engine` |
| Web | `apps/web/src/app/{purchases,sales,accounting,reports,settings}` |

## b) Stage status

| # | Stage | Status | Evidence |
|---|---|---|---|
| 1 | Authentication | **done** (feature/auth-hardening) — was partial: | Refresh rotation exists (`auth.service.ts:164`) but no reuse detection (old token simply misses). Session revoke exists (`:230`). Login throttle 10/min + `failedLoginAttempts`/`lockedUntil`. Auth audit via `audit.record`. `User.mfaEnabled` / `Session.mfaVerifiedAt` columns exist but **no MFA implementation**. |
| 2 | VAT & tax engine | **done** (feature/vat-engine) — was missing: | No `TaxCode` model. VAT stored only as `InvoiceLine.taxRate`. `ai.constants.ts` hardcodes `STANDARD_VAT_RATE`. No VAT return. |
| 3 | AI gateway + business profile | **done** (feature/ai-gateway) — was partial: | `ILlmProvider` interface exists; only a heuristic regex provider. No prompt versioning, usage/cost log, or per-org AI switch. `OrganizationBusinessContext` exists (industry, inventory) but no VAT scheme/supplier habits/refresh job. |
| 4 | AI safety fixes | **done** (feature/ai-safety) — was missing: | See risks below. |
| 5 | Upload/storage/OCR | **done** (feature/document-upload) — was partial: | Storage service exists; `AiDocument` has no content hash; no PDF text layer / OCR / word positions. |
| 6 | Background processing | **done** (feature/document-pipeline) — was missing: | `processDocument` runs synchronously in the upload request (`document-intelligence.controller.ts:45`). No queue. |
| 7 | LLM extraction | **done** (feature/llm-extraction) — was missing: | No real model; no schema, source quotes, or prompt-injection handling. |
| 8 | Validation | **done** (feature/extraction-validation) — was missing: | No arithmetic/VAT-number/duplicate checks on extractions. |
| 9 | Direction & supplier matching | **done** (feature/supplier-matching) — was partial: | `transaction-direction.service.ts` (name/VAT rules), `entity-resolution.service.ts`; no company-number or thresholded fuzzy match. |
| 10 | Account & tax suggestion | **done** (feature/coding-suggestion) — was partial: | `accounting-classification`, `line-classification`, `ai-feedback` exist; not constrained to org accounts + tax codes; reasons partly stored. |
| 11 | Supplier bills | **done** (feature/supplier-bills) — was missing: | No bill model. `JournalSourceType.BILL` enum value exists only. |
| 12 | Human review & permissions | **done** (feature/ai-review) — was partial: | `AiSuggestion` approve/edit/reject endpoints; no `ai_draft.approve` permission, no side-by-side log, no review UI with highlights. |
| 13 | E2E test | **missing** | |
| 14 | Email ingestion (added 2026-10-15) | **missing** | Not in the original stage list; deferred from Stage 5 at the user's request. |

## c) Risks found (existing AI prototype)

1. **Purchase documents become SALES invoices.** `document-intelligence.service.ts:545` `createInvoiceDraftFromSuggestion` always creates an `Invoice` (sales model) regardless of direction.
2. **Auto-approval.** `:265-290` auto-drafts and marks the suggestion `APPROVED` with no reviewer when confidence is HIGH and `autoDraftIfHighConfidence` is set. Violates rule 5.
3. **Default direction = PURCHASE.** `transaction-direction.service.ts` fallback returns PURCHASE at 0.5 instead of UNKNOWN.
4. **Loose name matching.** Direction Priority 1 uses bidirectional `includes()` – "AB" matches "ABC Ltd"; short org names misfire. Company number never compared.
5. **Fabricated fields.** Heuristic provider invents invoice number `INV-<timestamp>`, invoice date = today, a fake "Standard Line Item", and totals from `parseFloat` sums (float money). `createInvoiceDraftFromSuggestion` defaults currency `GBP`, issue date today, due date +30 days, and renames duplicate invoice numbers (hides duplicates).
6. **Unsafe tax defaults.** `tax-classification.service.ts` returns `VAT_STANDARD_20` for anything not zero/exempt; `document-intelligence.service.ts:185` defaults `'VAT_STANDARD'`. Input VAT is pointed at a `TAX_PAYABLE` account.
7. **Default account.** `:583` uses the first active account in the org as a fallback line account.
8. **Synchronous processing** inside the HTTP request; no retries/idempotency.

Each becomes a regression fixture in Stage 4.

## d) Per-stage work

Every stage: branch `feature/<stage>`, tests first, full unit + e2e suite green, money-moving stages include a trial-balance-balances assertion.

1. **auth-hardening** – Files: `auth/mfa.service.ts` (TOTP, RFC 6238, recovery codes), `auth.service.ts` (MFA step-up login, refresh reuse detection → revoke session family), `auth.controller.ts` (`/auth/mfa/*`, revoke-all). Migration: `user_mfa_secrets` (encrypted secret), `mfa_recovery_codes`, `sessions.family_id`, `sessions.previous_refresh_hash`. Tests: TOTP vectors, reuse detection, MFA required for OWNER/ACCOUNTANT roles, lockout, audit events. Done when: owner cannot reach org endpoints without verified MFA; reused refresh token revokes the session.
2. **vat-engine** – `src/tax/` module: `TaxCode` + `TaxRate` (effective_from/to) seeded with the 8 UK codes; `vat-calculation.ts` single function (line vs invoice rounding, net/gross); journal lines gain `tax_code_id`, `net_amount`, `tax_amount`; `vat-return.service.ts` boxes 1–9 from ledger with drill-down endpoint. Migration for tax tables + journal line columns. Tests: rounding cases, reverse charge (boxes 1/4 both), PIVA, box totals vs ledger, approval blocked without tax code. Done when: VAT return for a seeded period matches hand-calculated boxes.
3. **ai-gateway** – `src/ai/gateway/ai-gateway.service.ts` wrapping `ILlmProvider` adapters; `ai_prompt_versions`, `ai_usage_logs` (tokens, cost, org, prompt version), `organizations.ai_enabled`; extend business profile (VAT scheme, usual contacts, coding habits) + refresh job (runs on the Stage 6 queue; until then a callable service). Done when: all model calls go through gateway; disabled org gets 403-style domain error; usage logged.
4. **ai-safety** – Fix risks 1–7: direction by exact normalised name / VAT / company number, UNKNOWN fallback; remove all fabricated defaults and the default tax/account; delete auto-approve path; stop routing purchases to `Invoice`. Fixtures under `src/ai/__fixtures__/`. Done when: every listed bug has a failing-then-passing test.
5. **document-upload** – private per-org key prefix, MIME sniffing + size limit, `content_sha256` unique per org, `document_pages`/`document_words` (bbox). PDF text via `pdfjs-dist`; OCR via Tesseract (see Q2). Done when: duplicate upload returns existing doc; text-layer PDF skips OCR.
6. **document-pipeline** – queue (see Q1), workers per state, `AiDocumentStatus` replaced with the specified states + `failure_reason`, job idempotency key, exponential backoff, DLQ table, per-org rate/cost limits. Done when: killing a worker mid-job and retrying yields one result.
7. **llm-extraction** – JSON Schema (all nullable, `source_quote` per field), temperature 0, org identity in system prompt, document text in a delimited data block with injection instructions; schema validation rejects off-schema output. Tests with recorded provider responses + injection fixture.
8. **extraction-validation** – `validation.service.ts` producing per-field `verified|inconsistent|missing`; UK VAT mod-97/mod-9755 check; duplicate by supplier+invoice number. Never mutates values.
9. **supplier-matching** – rules (VAT → company no → fuzzy name ≥ threshold), model fallback only for direction when rules return UNKNOWN; "proposed new contact" record, never auto-create.
10. **coding-suggestion** – supplier history first, then model constrained to org account IDs + tax code IDs (enum in schema); reason stored.
11. **supplier-bills** – `src/bills/`: `Bill`, `BillLine` (tax code, net, VAT), status draft→approved→posted, due date from contact terms, duplicate warning, post via `JournalPostingService` (Dr expense/asset, Dr VAT input, Cr Creditors control), `source_document_id`. Tests incl. TB balance + VAT box 4/7.
12. **ai-review** – permission `ai_draft.approve`; `ai_review_decisions` (suggested vs approved JSON); web review screen `apps/web/src/app/purchases/review/[id]` with PDF + bbox highlights; queue sorted by confidence only.
13. **e2e-supplier-bills** – 10 fixtures in `apps/api/test/fixtures/bills/`, e2e spec producing a results table into `docs/e2e-results.md`.
14. **email-ingestion** (after Stage 13) – per-organisation inbound address (e.g. `<org-token>@bills.blynt…`) via an inbound-mail provider webhook (SES/SendGrid/Postmark, to decide) plus `.eml` upload; verify sender auth (SPF/DKIM result from provider), parse MIME, feed each PDF/image attachment (and the body when it is the invoice) through Stage 5 intake with the email as provenance; size/attachment-count limits; dedupe by attachment hash and Message-ID; reject/quarantine unknown senders per org setting. Tests: multipart .eml fixtures, forwarded emails, inline images, zip attachments rejected. Done when: emailing a supplier PDF produces the same awaiting-review document as uploading it.

## e) Open questions

1. **Queue technology** – BullMQ + Redis (adds Redis to docker-compose/AWS) or a Postgres-backed queue (pg-boss / `SELECT … FOR UPDATE SKIP LOCKED`, no new infra)? Recommend pg-boss.
2. **OCR** – local Tesseract (free, weaker on phone photos) vs a cloud OCR (AWS Textract, which the AWS migration may favour)? Recommend Textract behind an interface, Tesseract for dev/tests.
3. **LLM provider** – which provider(s) for the first real adapter (Claude via Anthropic API / Bedrock?) and do you have keys? Tests will use recorded responses either way.
4. **MFA method** – TOTP + recovery codes only, or also WebAuthn/email codes? And which role keys count as "owner/accountant" (`SystemRoleKey` values)?
5. **VAT scope** – which VAT schemes must Stage 2 support now (standard accrual only, or cash accounting / flat rate)? Is MTD submission to HMRC in scope or just box calculation?
6. **Existing journal lines** – backfill tax code/net/VAT on already-posted journals (immutable) via a side table, or only require it going forward?
7. **Existing AI data** – OK to change `AiDocumentStatus` enum and migrate/discard existing prototype rows?
8. **Fuzzy-name threshold** – start at 0.9 (trigram similarity) unless you have a preference.
9. **Stage order** – Stage 4 (safety fixes) currently leaves a known-unsafe path live until stage 4; want it moved first, or at least disable auto-draft immediately?

## Stage log

### Stage 1 – Authentication: done (branch `feature/auth-hardening`)
- TOTP MFA (RFC 6238, SHA-1, 6 digits, 30s, ±1 step), secrets AES-256-GCM encrypted with a key derived from `SESSION_SECRET`; replay blocked via `users.mfa_last_used_step` (compare-and-set).
- 10 single-use recovery codes, stored as HMAC hashes only.
- Enforcement lives in `OrganizationAccessGuard`: OWNER and ACCOUNTANT roles get `AUTH_MFA_REQUIRED` (403) on any org route until the session is MFA-verified. Users can still log in, enrol and use `/auth/*`.
- `MFA_REQUIRED_FOR_PRIVILEGED_ROLES` env flag (default true; env validation rejects false in production). Local `.env.test` sets it false so the existing e2e fixtures (unenrolled demo owner) keep working; `test/auth-hardening.e2e-spec.ts` turns it on.
- Refresh rotation is now compare-and-set and stores `previous_refresh_token_hash`; replaying a rotated token (or losing a rotation race) revokes the session and logs `REFRESH_TOKEN_REUSE_DETECTED`, attributed to the session owner.
- New endpoints: `POST /auth/mfa/{setup,enable,verify,disable}` (5/min throttle), `POST /auth/sessions/revoke-all`. Login/refresh responses include `mfaRequired`.
- Failed MFA codes share the login lockout counter (5 → 15 min lock + all sessions revoked).
- New audit events: MFA_SETUP_STARTED/ENABLED/ENABLE_FAILED/DISABLED/VERIFIED/FAILED/RECOVERY_CODE_USED, SESSIONS_REVOKED_ALL, REFRESH_TOKEN_REUSE_DETECTED.
- Deferred: web UI for MFA enrolment/challenge (API only); recovery-code regeneration endpoint; WebAuthn.
- Trial-balance totals bug found during Stage 1 was fixed separately on `fix/trial-balance-totals` (totals = sum of displayed rows; new `roundingDifference` field).

### Stage 2 – VAT & tax engine: done (branch `feature/vat-engine`, stacked on `fix/trial-balance-totals`)
- `tax_codes` + dated `tax_code_rates` (global system reference data, not tenant data): UK_SR (17.5% 2010 → 20% from 2011-01-04), UK_RR 5%, UK_ZR, UK_EX, UK_OS, UK_DRC_SR/RR, UK_RC_SERV, UK_PIVA_SR/RR. `GET /tax-codes?date=`.
- One calculation function `src/tax/vat-calculation.ts` (`calculateVat`): net or gross entry, line or invoice rounding (invoice mode allocates pennies by largest remainder so each line stays within 1p), reverse-charge/PIVA return 0 charged VAT plus notional VAT. Rounding goes through `MoneyService.round` (half-up); `MoneyService.wholePounds` added for boxes 6–9.
- Journal lines gain `tax_code_id`, `tax_direction` (OUTPUT/INPUT), `tax_net_amount`, `tax_amount` (signed; all-or-nothing DB CHECK). For reverse-charge treatments `tax_amount` is the self-accounted VAT.
- Posting validation (Rule 15): complete fields, code in force on posting date, net = line amount, VAT within 1p of net × rate, purchase-only codes rejected on sales, and every non-control line of an INVOICE/BILL journal must be coded (`TAX_CODE_MISSING`). Manual journals may omit tax codes (they then do not appear on the return).
- Reversals copy tax analysis with opposite sign, so voids/reversals come off the return in the reversal's period.
- VAT return: `GET /organizations/:orgId/vat-return?from&to` (boxes 1–9; 1–5 to the penny, 6–9 whole pounds) with a box-5 vs VAT-control-account reconciliation, and drill-down `GET .../vat-return/boxes/:box/lines`. New permission `vat_return.view` (Owner/Admin/Accountant; granted to existing roles by migration).
- Single VAT control account (2100 Tax Payable) holds both input and output VAT; boxes come from the tax fields, not account balances.
- Sales invoices: lines take `taxCodeId` (rate from the code on the issue date); net and VAT rounded to the penny via `calculateVat` (previously 4dp). Posting is blocked with `TAX_CODE_REQUIRED` if any line lacks a code. Legacy `taxRate`-only drafts still save but cannot post. Web new-invoice form uses a VAT-code select with no default; detail page shows the code. No backfill of already-posted invoices, so the box-5 reconciliation only holds for periods posted after this change.
- Behaviour change: invoice amounts are now whole pennies; e2e tests updated accordingly (sub-penny test rewritten).
- Deferred: boxes 2/8/9 (NI/EU goods) always 0; cash accounting and flat-rate schemes; MTD submission; gross entry / invoice-level rounding are in `calculateVat` but not yet exposed on the sales invoice form; VAT return web page; tax codes on manual journals.

### Stage 3 – AI gateway + business profile: done (branch `feature/ai-gateway`, stacked on `feature/vat-engine`)
- `AiGatewayService.run()` (`src/ai/gateway/`) is the single path for model calls: checks `organizations.ai_enabled` (default **off**), validates output against the prompt's Zod schema, rejects refusals / truncated / off-schema output, and writes an `ai_usage_logs` row for every attempt (BLOCKED, SUCCESS, REFUSED, INVALID_OUTPUT, ERROR) with tokens, USD cost, latency, prompt key/version/hash.
- Provider-agnostic `AiProvider` interface; `AnthropicAiProvider` (official `@anthropic-ai/sdk`, `messages.parse` + `zodOutputFormat`, default model `claude-opus-5-5`, effort per prompt) and `FakeAiProvider` (scripted, for tests/dev). Selected by `AI_PROVIDER=none|anthropic|fake` (default none).
- Prompt versioning: prompts are code (`definePrompt`) with key, version, system, `{{var}}` template, schema; sha256 hash pinned in `registry.spec.ts`, so editing a prompt without bumping its version fails CI. Missing template variables throw before any call.
- Pricing table (`pricing.ts`) holds only models with confirmed prices; unknown models log `cost_usd = NULL` (never 0) and the usage summary counts them as `unpricedCalls`.
- Business profile extends `organization_business_contexts`: `vat_scheme` (person-set, null = not stated), and derived `usual_suppliers`, `usual_customers`, `coding_habits`, `profile_refreshed_at` computed from the last 12 months of posted INVOICE/BILL journals. Refresh on demand or every `AI_PROFILE_REFRESH_MINUTES` (interim in-process timer; moves to the Stage 6 queue).
- Endpoints under `/organizations/:orgId/ai`: `GET/PUT settings`, `POST connection-check`, `GET usage?from&to`, `GET/PUT business-profile`, `POST business-profile/refresh`. New permissions `ai.manage` (Owner/Admin) and `ai.usage.view` (Owner/Admin/Accountant). Settings and profile edits are audited.
- **Decision affecting Stage 7:** current Claude models (incl. `claude-opus-5-5`) reject `temperature` with a 400, so "temperature 0" cannot be sent. Determinism comes from strict JSON-schema structured outputs, a fixed prompt version, and code-side validation instead.
- Deferred: server-side refusal fallbacks (the documented `fallbacks` parameter is on the beta messages endpoint; combining it with `messages.parse` is not documented, so not guessed); per-org rate/cost limits (Stage 6); prompt-cache tuning; web UI for AI settings/usage.
- Found for Stage 4: `BusinessContextService.getProfile` guesses `industry` from the organisation name and seeds it; `PUT /ai/business-context` requires permission `org.admin`, which does not exist (endpoint unreachable). Both superseded by the new profile endpoints and to be removed in Stage 4.

### Stage 4 – AI safety audit fixes: done (branch `feature/ai-safety`, stacked on `feature/ai-gateway`)
Every defect is a named fixture in `src/ai/__fixtures__/safety-fixtures.ts` with a test (unit and/or `test/ai-safety.e2e-spec.ts`):

| Bug | Was | Now |
|---|---|---|
| 01–02 | Direction by substring name match | Exact identity match against org VAT no. → company no. (zero-padded) → normalised name (`src/ai/identity/party-identity.ts`) |
| 03 | Org "ABC" matched "ABC Supplies Ltd" | No substring matching anywhere (direction and contact lookup) |
| 04 | No parties → PURCHASE @ 0.5 | UNKNOWN; approval refused with `AI_DIRECTION_UNRESOLVED` |
| 05 | Matching name, different VAT → treated as us | A registered identifier on both sides decides; mismatch = not us |
| 06 | Org on both sides → first rule wins | UNKNOWN (`CONFLICT`) |
| 07 | Invented `INV-<timestamp>`, today's date, GBP | Left null |
| 08 | 20% VAT computed on every line | VAT only as printed (or a single line's share when its net equals the subtotal) |
| 09 | Fake "Standard Line Item" | No lines → flagged as missing |
| 10 | Quantity 1 / price 0 defaults | null; unit price derived only if net ÷ qty is exact at 4dp |
| 11 | Unparseable date → today | null; impossible dates rejected |
| 12 | "Customer VAT: <ours>" read as issuer VAT → bill became a sale | Buyer-context lines attribute identifiers to the recipient |
| 13 | Unknown line → first active account; tax default VAT_STANDARD_20 | account/tax code null and listed in `missing`; tax code only when doc VAT/net = 20% or 5% within 1p |
| 14 | HIGH confidence auto-drafted and marked APPROVED | Removed: every suggestion is `REQUIRES_REVIEW`; confidence only orders the queue |
| 15 | Approving a purchase created a **sales** invoice | Refused with `AI_BILLS_NOT_AVAILABLE` until Stage 11; nothing created |
| 16 | Duplicate invoice number renamed `-1234` | Refused with `AI_DUPLICATE_DOCUMENT` |
| 17 | Pipeline ignored the org AI switch | `AI_DISABLED` |
| — | Industry guessed from org name and saved | Removed; neutral profile until a person sets it |
| — | `PUT /ai/business-context` required non-existent `org.admin` | Now `ai.manage` |

- Approved sales documents go through `InvoicesService.createInvoice` (code does all arithmetic, Stage 2 tax codes) as **DRAFT**s with the document number as `reference`; anything missing (dates, currency, quantity, unit price, account, tax code) returns `AI_DRAFT_INCOMPLETE` with the list. Nothing posts.
- `ai_line_classifications` amount/tax columns are now nullable (migration `20261015200000_ai_safety_nullable_lines`); `TaxClassificationService` and `AiActionPolicyService` deleted; upload DTO and web page no longer offer auto-draft.
- Known, deferred: `POST /ai/documents` is unreachable (stacked `@Post` decorators register only `/ai/documents/upload`) – fix with Stage 5 upload rework. The regex extractor is a stop-gap until Stage 7. Approve permission is still `invoice.create` until `ai_draft.approve` (Stage 12).

### Stage 5 – Upload, storage & OCR: done (branch `feature/document-upload`, stacked on `feature/ai-safety`)
- New `src/documents/` module. `DocumentIntakeService`: rejects empty files and files over `DOCUMENT_MAX_BYTES` (default 20 MB), detects the real type from magic bytes (PDF, JPEG, PNG, TIFF, UTF-8 plain text; markup and binaries rejected), and rejects a declared type that differs from the content (415).
- Storage key `orgs/<orgId>/documents/<uuid>.<ext>`: random, organisation-prefixed, no user-supplied path; S3 objects stay private with SSE. Display file names are stripped of paths/control characters.
- De-duplication: `ai_documents.content_sha256`, unique per organisation; an identical upload returns the existing document (`duplicate: true`) and is not reprocessed; concurrent duplicates resolved via the unique index.
- Text: digital PDFs use their embedded text layer (pdf.js 3.11 legacy build, `isEvalSupported: false` because of CVE-2024-4367); PDFs with almost no text (scans) and photos go to OCR. Words stored per page in `ai_document_pages.words` with boxes normalised 0..1 (top-left origin) for Stage 12 highlighting; `text_source` = PDF_TEXT / OCR / PLAIN_TEXT.
- OCR behind `OcrProvider`: `TextractOcrProvider` (AWS `DetectDocumentText`, sync: images and single-page PDFs) and `FakeOcrProvider`; `OCR_PROVIDER=none|textract|fake` (default none: photos are stored and marked FAILED with `OCR_UNAVAILABLE`, never guessed).
- Endpoints: `POST /ai/documents` is now a real multipart upload (field `file`), fixing the unreachable stacked route; `POST /ai/documents/upload` keeps the JSON text path the web page uses. AI switch checked before anything is stored. The pipeline reads the stored text.
- Decisions: Tesseract dropped for now. tesseract.js downloads language data at runtime (no network in CI) and cannot read PDFs, so tests use the fake provider and production uses Textract.
- Deferred: email ingestion (.eml / inbound mailbox, attachments): not in the Stage 5 list; propose a separate stage. Multi-page scanned PDFs need Textract's async S3 API (Stage 6 jobs). Web file picker (the page still posts pasted text) moves to Stage 12. Textract not exercised against live AWS.

### Stage 6 – Background processing: done (branch `feature/document-pipeline`, stacked on `feature/document-upload`)
- **Queue decision:** a Postgres `jobs` table claimed with `FOR UPDATE SKIP LOCKED` (`src/jobs/`), one of the two options agreed for Q1, instead of pg-boss. No new library or schema; idempotency is a unique `idempotency_key`; the dead-letter queue is `status = DEAD`; per-organisation rate limiting happens at claim time. Any number of API/worker processes can share it.
- `JobQueueService`: idempotent `enqueue` (also inside a caller's transaction), `claim`, exponential backoff (`JOB_RETRY_BASE_MS` × 2^(n-1), capped at `JOB_RETRY_MAX_MS`), `bury` (DLQ), `defer` (rate limit, attempt not counted), stale-lock recovery (`JOB_LOCK_TIMEOUT_MS`), dead-letter list and requeue.
- `JobWorkerService`: in-process poller (`JOB_WORKER_ENABLED`, `JOB_POLL_INTERVAL_MS`); handlers register themselves. `PermanentJobError`/`DomainException` = dead-letter immediately; anything else retries. `onDead` lets a handler record the failure. `drain()` runs jobs deterministically in tests.
- Document states: UPLOADED → TEXT_EXTRACTED → AI_EXTRACTED → VALIDATED → AWAITING_REVIEW → DRAFT_CREATED | REJECTED | FAILED (`failure_code` + message). The migration maps prototype states (PENDING/PROCESSING → UPLOADED, REQUIRES_REVIEW → AWAITING_REVIEW, DRAFTED/APPROVED → DRAFT_CREATED).
- Jobs: `document.extract_text` (UPLOADED → TEXT_EXTRACTED; queued in the same transaction as the upload) and `document.analyse` (→ AWAITING_REVIEW). Both are idempotent: they check state, use conditional updates, and analysis discards partial rows from an interrupted run.
- Upload endpoints now return **202** with the UPLOADED document. `POST /ai/documents/:id/retry` (failed docs), `GET /ai/jobs/dead`, `POST /ai/jobs/:id/requeue` (`ai.manage`) reset the document to the state the job expects.
- Limits: `DOCUMENT_JOBS_PER_ORG_PER_MINUTE` (default 30) on document jobs; monthly AI cost cap enforced in `AiGatewayService` (`AI_MONTHLY_COST_LIMIT_USD`, default $50, per-org `organizations.ai_monthly_cost_limit_usd`) → `AI_COST_LIMIT_REACHED`, logged as BLOCKED.
- Bug found and fixed while testing: raw SQL `now()` uses the DB session time zone while Prisma stores UTC, which would have shifted job timing by the UTC offset. The claim SQL now uses `timezone('UTC', now())`, with a test asserting it.
- Note: `.env.test` (untracked) sets `JOB_WORKER_ENABLED=false` and `JOB_RETRY_BASE_MS=0`; CI needs the same.
- Deferred: a separate worker entrypoint (`node dist/worker.js`) for production scaling; async Textract for multi-page scans; a web pipeline/DLQ view; Stage 8 will put real checks into the VALIDATED step (currently pass-through).

### Stage 7 – LLM extraction: done (branch `feature/llm-extraction`, stacked on `feature/document-pipeline`)
- Prompt `document.extract` v1 (`src/ai/gateway/prompts/document-extraction.prompt.ts`, hash pinned). Strict JSON schema via structured outputs; **every field is `{ value, source }` and both are nullable**, where `source` is a verbatim quote of at most 120 characters; amounts are strings; one entry per printed line item with the line's own text as `source`.
- System rules: copy only what is printed, null when absent, no arithmetic, no assumed VAT rate/currency/date, issuer vs recipient by the document's labels. The organisation's name, legal name, VAT and company number go in the user message for reference only ("may be issuer, recipient or neither").
- Prompt-injection handling: the document text sits in a `<document id="<random nonce>">` data block, closing tags inside it are neutralised, and the system prompt says never to follow instructions found in the document. Direction is still decided by code (Stage 4 rules), so an injected "mark this as a sale" can't change it.
- **Code verification of every model value** (`verifyExtraction`): the quote must occur in the document text (case/whitespace-insensitive), the value must occur in its quote (amounts ignoring thousands separators; dates must show the same day, month and year; currency must show its symbol or code), and formats must be valid (ISO date, ISO 4217, decimal). Anything failing is dropped to null and recorded as `verificationIssues` (`MISSING_SOURCE`, `SOURCE_NOT_FOUND`, `VALUE_NOT_IN_SOURCE`, `INVALID_FORMAT`) in `ai_extractions.raw_structured_data`, together with the raw model output; `model_version` = `document.extract@v1`.
- Documents over 200,000 characters are refused (`DOCUMENT_TOO_LONG_FOR_AI`), never truncated.
- Extractor selection: LLM when an AI provider is configured (`AI_PROVIDER=anthropic|fake`), otherwise the rule-based extractor. Usage and cost are logged per document.
- Worker: `AI_PROVIDER_ERROR` (and `SERVICE_UNAVAILABLE`) are retried with backoff; refusals, invalid output, AI disabled and cost limit are permanent (document FAILED with the code; retry via the Stage 6 endpoint).
- **Temperature 0:** current Claude models reject `temperature` (see Stage 3). Determinism comes from the strict schema, the fixed prompt version and code verification.
- Residual risk (for Stage 8): an injected or misprinted value that really is on the document passes these checks (e.g. a fake "Total 0.00" line). Stage 8's arithmetic validation and the mandatory human review remain the controls.
- Not done: no live call against the Anthropic API yet (fake provider in tests).

### Stage 8 – Validation: done (branch `feature/extraction-validation`, stacked on `feature/llm-extraction`)
- `ExtractionValidationService` (`src/ai/validation/`) runs in the pipeline's VALIDATED step and is **read-only**: it never changes a value (a test freezes the input). Each field (`invoiceNumber`, `issuer.vatNumber`, `lines[2].vat`, …) is `verified`, `inconsistent` or `missing`, with messages; values dropped by Stage 7 source checks show as missing with the reason.
- Rules (each only when every number involved is present): line nets = subtotal; subtotal + VAT = total; each line's VAT is 0/5/20% of its net within 1p; line net + VAT = line total; line VATs = VAT total; UK VAT number format and HMRC check digits (mod 97 and 97-55; 9/12-digit, GD/HA, GB/XI; non-UK numbers not judged); invoice date not more than 31 days ahead or 6 years old; due date not before invoice date; currency present and equal to the organisation's base currency; **duplicate** = same invoice number and same supplier (VAT number, else matched contact, else normalised name) on another document that is not rejected/failed.
- Stored on `ai_extractions.validation` (JSON) and `is_consistent`; summary and findings copied into the suggestion payload; `VALIDATED` audit event.
- **Decision (approved 2026-10-16):** approval is refused while any field is `inconsistent`, unless the reviewer edits the value or explicitly overrides the finding with a reason; overrides are logged with the AI suggestion and final values (built with approval in Stages 11/12). Validation itself still only reports.
- Previously: validation **reports and does not block**. Inconsistent or missing fields stay visible for the reviewer; Stage 11/12 decide what approval requires (proposal: approval refused while a field is inconsistent unless the reviewer edits or explicitly overrides it, which is logged).
- Test isolation fix: suites now restore env vars properly (`test/env.helper.ts`; assigning `undefined` to `process.env` leaves the string "undefined"). The shared demo organisation tripped the per-org job rate limit across a full e2e run, so `.env.test` raises it and the rate-limit test uses its own worker. Stage 13 should give e2e runs their own organisation or a reset database.

### Stage 9 – Direction & supplier matching: done (branch `feature/supplier-matching`, stacked on `feature/extraction-validation`)
- **Matching order** (`EntityResolutionService`): VAT number (normalised, against both contact VAT fields) → company number (leading zeros normalised) → exact normalised name (Ltd = Limited, "the", punctuation) → fuzzy name with pg_trgm-style trigram similarity ≥ **0.9** (`FUZZY_NAME_THRESHOLD`, single clear winner only) → contact-person email. Only ACTIVE contacts of the organisation; the expected role (supplier/customer/both) is preferred for name matches; a contact whose VAT/company number contradicts the document is never matched by name.
- Ties are returned as `AMBIGUOUS` with candidates rather than picked. Near misses (similarity 0.6–0.9) are listed as `candidates` for the reviewer. Example scores: "ABC Fuel Ltd"/"ABC Fuels Ltd" 0.73, "Hilltop Garage Services"/"Hilltop Motor Services" ≈0.7 (candidates); near-identical long names pass 0.9 (match).
- **Direction:** Stage 4 identity rules first. Only when they return `NONE` (no identifying data) and an AI provider is configured, the `document.direction` v1 prompt is asked; its answer is kept only if its verbatim evidence is on the document, with basis `MODEL`, confidence 0.6 and the reason "Suggested by AI (reviewer must confirm)". `CONFLICT` (org on both sides) goes straight to a person.
- **Proposed contacts:** when the counterparty is not matched, the suggestion carries `proposedContact` built only from the document (name, VAT number, company number) and `counterpartyMatch` (type, reason, candidates). Nothing is created automatically (test checks the contact count). `POST /ai/documents/:id/proposed-contact` (`contact.create`) lets a reviewer create it (optionally correcting the name) through `ContactsService`, then re-analyses the document so it matches by identifiers (one more model call when the LLM extractor is on); audited as REVIEWED/PROPOSED_CONTACT_ACCEPTED.
- Deferred to Stage 12: choosing one of the `candidates` from the review screen (approve/edit already accept a `contactId`); a reviewer confirming a MODEL-basis direction.

### Stage 10 – Account & tax suggestion: done (branch `feature/coding-suggestion`, stacked on `feature/supplier-matching`)
- `CodingSuggestionService` (`src/ai/coding/`) codes each line in this order, recording `accountSource` / `taxSource` (`HISTORY`, `RULE`, `DOCUMENT`, `MODEL`, `NONE`) and a reason for the reviewer:
  1. **Document VAT:** when the line's printed VAT fixes the rate (20%/5%), that tax code wins over everything else.
  2. **History:** this counterparty's previously posted, tax-analysed lines (POSTED INVOICE/BILL journals containing the contact, same tax direction, last 200). Best description match (trigram similarity ≥ 0.6), else the counterparty's dominant coding (≥ 80% of at least 3 lines). Archived accounts and tax codes not in force on the document date are ignored. The reason cites the journal number and date.
  3. **Rules:** a category that identifies exactly one account (inventory, fixed asset, sales).
  4. **Model** (`coding.suggest` v1), only for lines still missing something and only with an AI provider. The structured-output schema is built per call as an enum of **this organisation's postable accounts** (active, not control, right side: expense/asset for purchases, revenue for sales) and **tax codes in force** (purchase-only codes excluded on sales), so it cannot return anything else. Line descriptions are passed as delimited untrusted data.
- Tax codes from history/model must agree with printed VAT: positive VAT must match the rate within 1p; 0.00 VAT allows only nil-rate or reverse-charge/PIVA codes; otherwise dropped with a note in the reason.
- Stored on `ai_line_classifications` (`resolved_account_id`, `suggested_tax_code_id`, `account_source`, `tax_source`, `coding_reason`), in the suggestion payload (`coding`), and used for the proposed journal (`missing` lists anything uncoded). The document detail endpoint returns the suggested tax code.
- History today comes from posted sales invoices (customers); supplier history starts once Stage 11 posts bills, with no code change needed (BILL journals are already included).
- Not done: a fake-model e2e for the MODEL path (covered by unit tests); live model call.

### Stage 11 – Supplier bills: done (branch `feature/supplier-bills`, stacked on `feature/coding-suggestion`)
- New `bills` / `bill_lines` (`src/bills/`): DRAFT → POSTED (via APPROVED inside the approval transaction) → VOIDED. Internal number `BILL-YYYY-NNNNNN` plus the supplier's own invoice number; issue date; due date as stated or **issue date + the supplier contact's payment terms**; base currency only (as sales invoices); optional `source_document_id` linking the uploaded document.
- Lines: account, description, tax code (required to approve, never defaulted), and either quantity × unit price or a **printed net amount** (quantity/unit price stay null rather than inventing "1 ×"; if both are given they must agree). VAT via the shared `calculateVat` (line rounding); reverse-charge/PIVA lines charge 0 VAT.
- **Approval** (`POST /bills/:id/approve`, permission `bill.approve` plus the posting engine's own check) builds the journal with `buildBillJournalLines`: Dr expense/asset per line (tax-analysed INPUT, net and VAT/self-accounted VAT), Dr VAT control (charged VAT), Dr/Cr VAT control (reverse charge / PIVA self-accounting), Cr creditors control (contact's payable account or the AP account) tagged with the supplier. It is validated and posted through `JournalPostingService` in one transaction (sourceType BILL, journalType PURCHASE). Posted bills cannot be edited; `POST /bills/:id/void` reverses the journal.
- **Duplicates:** same supplier + supplier invoice number (case-insensitive) on another non-voided bill produces a warning on create/read; approval is refused (`BILL_DUPLICATE`) unless `duplicateOverrideReason` is given, which is stored in the audit log.
- **Attachment:** `GET /bills/:id/attachment` streams the source document (inline, nosniff).
- **AI path:** approving a PURCHASE suggestion now creates a **DRAFT bill** (never posted) with the document attached, account/tax code from Stage 10 coding or reviewer overrides; refused with `AI_DRAFT_INCOMPLETE` if the supplier invoice number, date, currency, account, tax code or amount is missing, and with `AI_DUPLICATE_DOCUMENT` if the supplier invoice is already a bill. The Stage 4 BUG-15 test now expects "a supplier must be chosen" and still proves no sales invoice is created.
- Permissions `bill.view/create/edit_draft/delete_draft/approve/void` (Owner/Admin/Accountant all; Bookkeeper view/create/edit; Viewer view), granted to existing roles by migration.
- E2E checks: balanced journal, trial balance still balances, VAT box 4/7 movement, reverse charge boxes 1/4/7 with box 5 unchanged, void reversal, duplicate override, attachment bytes.
- Noted: AI-proposed contacts get the contacts module's default 30-day payment terms (contact master data), which then drives the due date when the bill shows none; Stage 12's review should show it. No web UI for bills yet (Stage 12). Applying the Stage 8 inconsistent-field rule to AI approvals is Stage 12.

### Stage 12 – Human review & permissions: done (branch `feature/ai-review`, stacked on `feature/supplier-bills`)
- **Single approval path** (`AiReviewService.approve`, `POST /ai/documents/:id/review/approve`): every field is editable (type, contact, invoice number, dates, currency, VAT numbers, totals, each line's description/qty/price/net/VAT/account/tax code). The final values are **re-validated** with the Stage 8 rules, and approval is refused (`AI_REVIEW_INCONSISTENT`, listing fields and findings) while any field is inconsistent, unless the reviewer corrects it or gives a reason (at least 5 characters) for that field. The existing `/approve` and `/edit` endpoints now build the same request from the AI values and go through the same checks.
- **Permission `ai_draft.approve`** (Owner/Admin/Accountant; granted by migration) on approve, edit and reject, plus `bill.create` / `invoice.create` for the draft being created. Bookkeepers can view the review but not approve (tested).
- **Decision log** `ai_review_decisions`: AI values and final values side by side, `changedFields` (decimal-aware), accepted overrides with reasons and findings, outcome (APPROVED / EDITED / REJECTED), resulting bill/invoice. **Append-only**, enforced by a database trigger (tested). Account corrections also feed `ai_feedbacks`.
- **Review payload** `GET /ai/documents/:id/review`: every header field and line with status (verified / inconsistent / missing), findings, source quote and highlight boxes (`findBoxes` locates the quote or value among the stored word boxes), plus counterparty match / proposed contact, coding reasons and pages. `GET /ai/documents/:id/file` streams the original.
- **Queue** `GET /ai/review-queue?sort=confidence_desc|confidence_asc|oldest`: confidence only orders it; nothing is approved automatically.
- **Web:** `/purchases/review` (queue) and `/purchases/review/[id]` (document beside the editable fields; focusing a field highlights it on the document; inconsistent fields get a reason box; create proposed contact; approve or reject). Photos are shown as images with highlight boxes; PDFs as a positioned reconstruction of their words with the boxes, plus "Open original". `/purchases/bills` now lists real bills (it previously listed **sales invoices** – fixed) and `/purchases/bills/[id]` approves and posts (with a duplicate-override reason when needed), voids and opens the attachment.
- Checked in the browser on the dev stack: queue → review (total flagged inconsistent, approval blocked) → corrected total → draft bill → approve and post (journal created). This found and fixed two bugs: the contact list ignored the paginated `/contacts` response (the matched supplier wasn't selected), and the account list offered bank/cash accounts.
- Deferred: pixel-perfect PDF rendering in the browser (pdf.js) under the highlights; a confirmation step specifically for MODEL-basis direction (the reviewer sets the type explicitly in the form, and changes are logged); picking a fuzzy candidate with one click.
- Local preview: `.claude/launch.json` runs the web app; the API runs separately (the preview tool's PORT applies to the whole process).
