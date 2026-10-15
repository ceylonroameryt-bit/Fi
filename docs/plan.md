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
| 6 | Background processing | **missing** | `processDocument` runs synchronously in the upload request (`document-intelligence.controller.ts:45`). No queue. |
| 7 | LLM extraction | **missing** | No real model; no schema, source quotes, or prompt-injection handling. |
| 8 | Validation | **missing** | No arithmetic/VAT-number/duplicate checks on extractions. |
| 9 | Direction & supplier matching | **partial** | `transaction-direction.service.ts` (name/VAT rules), `entity-resolution.service.ts`; no company-number or thresholded fuzzy match. |
| 10 | Account & tax suggestion | **partial** | `accounting-classification`, `line-classification`, `ai-feedback` exist; not constrained to org accounts + tax codes; reasons partly stored. |
| 11 | Supplier bills | **missing** | No bill model. `JournalSourceType.BILL` enum value exists only. |
| 12 | Human review & permissions | **partial** | `AiSuggestion` approve/edit/reject endpoints; no `ai_draft.approve` permission, no side-by-side log, no review UI with highlights. |
| 13 | E2E test | **missing** | |

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
