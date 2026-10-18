# Blynt – sales and purchases plan

Status: Part 1 approved (2026-10-17, recommendations accepted for all open questions). **Stage 0 done**; Stage 1 next.
Rules: [CLAUDE.md](../CLAUDE.md). Earlier AI-pipeline work: [plan.md](plan.md) (Stages 1–13 done, 14 email ingestion pending).

Goal: build sales and purchases together on **one commercial-document engine**, so invoice, bill and credit-note logic exists once. The AI pipeline is part of this: every new document type it can recognise (sales invoice, bill, credit note, expense receipt) becomes a **draft** of the matching type, through the same review screen. Nothing the AI does posts.

---

## a) Current state

### Phase 26 – VAT engine: **mostly done** (built in plan.md Stage 2)
| Requirement | State |
|---|---|
| Tax codes as dated global data | Done: `tax_codes` + `tax_code_rates` (effective from/to). `UK_SR` 20%, `UK_RR` 5%, `UK_ZR`, `UK_EX`, `UK_OS`, domestic reverse charge 5%/20%, `UK_RC_SERV` imported services, postponed import VAT 5%/20%. |
| One shared calculation function | Done: `src/tax/vat-calculation.ts` `calculateVat` (half-up to the penny, via `MoneyService`). Used by invoices and bills. |
| Every posting stores tax code / net / VAT | Done: journal lines carry `taxCodeId`, `taxDirection`, `taxNetAmount`, `taxAmount`; validation Rule 15 checks them; reversals negate them. |
| VAT return boxes 1–9 from the ledger | Done: `vat-return.service.ts` + `vat-boxes.ts`, with drill-down and a VAT-control reconciliation. |
| Missing tax code blocks approval | Done for invoices and bills. |
| **VAT schemes as an organisation setting** | **Missing.** A `VatScheme` enum exists (STANDARD, CASH_ACCOUNTING, FLAT_RATE, ANNUAL_ACCOUNTING, NOT_REGISTERED) but is stored only on the AI business profile. The VAT return always works on the invoice (accrual) basis; **cash accounting and Flat Rate are not implemented.** |

→ **Stage 0 is needed, but only for the VAT schemes** (details below). The rest of Phase 26 is skipped.

### Phase 17 – Contacts: **mostly done**
`contacts` has type (CUSTOMER/SUPPLIER/BOTH), status, VAT number, company number, payment terms (days, default 30), credit limit, addresses, receivable/payable control-account overrides, contact people, statements, activity and subledger balances.
Missing: **VAT-number format check on contacts** (the checker exists in `src/ai/validation/vat-number.ts` but contacts don't use it), **default account**, **default tax code**.

### Sales invoices (Phase 18): **partial**, `src/invoices/`, `invoices` + `invoice_lines`
- Create/update/delete draft, post (Dr debtors / Cr revenue per line / Cr VAT through the posting engine), void by reversal. Tax codes required.
- **Number allocated when the draft is created**, not at approval (brief wants approval).
- No approved state separate from posted; statuses include PAID/PARTIALLY_PAID but nothing sets them (no payments).
- No PDF. No credit notes. Web: list, new, detail.

### Supplier bills (Phase 22): **done** (plan.md Stage 11), `src/bills/`, `bills` + `bill_lines`
- Supplier invoice number + internal `BILL-YYYY-NNNNNN`, duplicate check with logged override, approve → post (Dr expense/asset, Dr VAT input, Cr creditors; reverse charge self-accounted), void by reversal, source-document attachment. Web: list, detail, AI review.
- `bill_lines` already allows "net only" (no invented qty × price); `invoice_lines` doesn't.

### Duplication today
`invoices.service.ts` and `bills.service.ts` each have their own totals calculation, number allocation, draft locking, status checks, void logic and journal builder. Two tables with nearly identical columns. This is what the shared engine replaces.

### Not built at all
Customer payments (19), credit notes & refunds (20), AR ageing (21), supplier payments (23), AP ageing (24), expenses & receipts (25). The web navigation already links to `/sales/credit-notes`, `/purchases/expenses`, `/purchases/payments`, `/reports/ar-ageing`, and these pages 404. No allocation table. No PDF library in the API.

### AI pipeline (already built)
Upload/OCR → extraction → validation → supplier/customer matching → account and tax suggestion → human review → draft. Today a PURCHASE becomes a draft bill and a SALE a draft sales invoice. The extractor already classifies `PURCHASE_CREDIT_NOTE`, `SALES_CREDIT_NOTE`, `RECEIPT` and `EXPENSE_RECEIPT`, but nothing consumes those types yet.

---

## b) Stage 0 – VAT schemes (`feature/vat-schemes`)
Only the missing part of Phase 26.
- **Setting:** `organizations.vat_scheme` (enum `VatScheme`, default STANDARD; NOT_REGISTERED for unregistered businesses) plus `flat_rate_percent`, `flat_rate_start_date`, `limited_cost_trader` on the organisation, dated history in `organization_vat_scheme_periods` so a scheme change applies from a date and old returns don't change. The AI business profile reads this setting instead of storing its own copy (migration copies the value over).
- **Standard:** unchanged (invoice/tax-point basis).
- **Cash accounting:** VAT counts in the period the **payment** is received/made. Box values come from payment allocations (Stage 3) apportioned by the share of each document paid: `VAT in period = document VAT × allocated / document total`, using `calculateVat`-style rounding. Until Stage 3 lands, the cash basis returns "no payments yet" rather than guessing. Reverse charge and imports stay on the invoice basis (HMRC rule).
- **Flat Rate:** box 1 = flat-rate % × VAT-inclusive turnover in the period; box 4 = only capital assets over £2,000 (incl. VAT) on a single invoice; box 6 = VAT-inclusive turnover. 16.5% limited-cost-trader rate is a stored percentage, chosen by the user (we do not decide it). The difference between VAT charged and the flat-rate amount is posted as income by a period-end journal through the posting engine (shown on the return before posting).
- **Not registered:** sales invoices may not charge VAT (codes limited to UK_OS); bills record gross into expense (no input VAT reclaim).
- Missing tax code still blocks approval (unchanged).
- **Files:** `prisma` migration; `src/tax/vat-schemes.ts` (pure box functions per scheme), `vat-return.service.ts` (scheme dispatch), `organizations` DTO/service; web Settings → Taxes page (scheme, flat-rate %, start date).
- **Tests:** unit per scheme (incl. FRS capital-asset threshold, rate change mid-period); e2e: same postings give different boxes under each scheme; FRS adjustment journal balances; trial balance still balances.
- **Done when:** switching the scheme from a date changes only later returns, each scheme's boxes match hand-worked examples, and the suite passes.

---

## c) Stage 1 – Contacts and the shared document model (`feature/commercial-documents`)

### Contacts
- VAT number: normalise and format-check with the existing `vat-number.ts` (GB mod-97 + XI + EU formats); invalid → 400 with the reason. Existing invalid values are reported by a one-off check script, not altered.
- New columns: `default_account_id`, `default_tax_code_id` (both optional, validated: account must be postable expense/asset for suppliers or revenue for customers; tax code must suit the direction). Payment terms already exist.
- Defaults pre-fill new **manual** lines only; they are shown as defaults and never applied silently to AI drafts (AI coding keeps its own sources: document → history → contact default → rules → model; the contact default becomes a new `CONTACT_DEFAULT` source with the reason shown).

### One document model
Tables (replace `invoices`/`invoice_lines`/`bills`/`bill_lines`):
- `commercial_documents`: `id`, `organization_id`, `kind` (SALES_INVOICE, SALES_CREDIT_NOTE, BILL, SUPPLIER_CREDIT_NOTE), `contact_id`, `number` (our sequential number; null while draft), `contact_reference` (supplier's invoice number / customer PO), `issue_date`, `due_date`, `currency`, `subtotal`, `tax_total`, `total`, `amount_allocated`, `status`, `related_document_id` (credit note → original), `source_document_id` (AI upload), `journal_entry_id`, `vat_scheme_at_posting`, notes/terms, audit columns (created/approved/posted/voided by and at, void reason).
- `commercial_document_lines`: line number, account, description, quantity and unit price **or** net only (as bill lines today), tax code, rate, net, VAT, line total.
- `commercial_document_tax_lines`: one row per tax code: net and VAT totals per code (what the PDF and VAT return analysis show; computed by code, never stored from input).
- `document_attachments`: file key, name, MIME, size, sha256, uploaded by (the AI upload is one kind of attachment; manual attachments allowed too).
- `allocations` (built here, used from Stage 3): `from_type` (PAYMENT / CREDIT_NOTE / CUSTOMER_CREDIT), `from_id`, `document_id`, `amount`, `date`, `journal_entry_id` (when the allocation itself posts), reversed flag. A document's balance = total − sum of active allocations.

Status machine (same for all kinds), enforced in one place `document-status.ts`:
`DRAFT → APPROVED → POSTED → PARTIALLY_PAID → PAID`, any posted state `→ VOIDED` (by reversal; only while nothing is allocated). APPROVED and POSTED happen in one transaction today (approve = post); APPROVED is kept as a state so an "approve now, post on issue date" option can be added without a schema change. PAID/PARTIALLY_PAID are **derived** from allocations, not edited.

Shared engine `src/commercial-documents/`:
- `document-calculation.ts` (lines → net/VAT/totals/tax lines via `calculateVat`),
- `document-numbering.ts` (one `OrganizationSequence` per kind and year, allocated at approval),
- `document-journal.ts` (sales vs purchase journals from one builder; existing `bill-journal.ts` and the invoice journal fold into it),
- `document-status.ts`, `document-duplicates.ts`, `commercial-documents.service.ts` (create/update/delete draft, approve, void),
- thin kind-specific services/controllers keep today's URLs (`/invoices`, `/bills`) so the web and AI review keep working.

**Migration of existing data:** copy every invoice and bill (with lines) into the new tables keeping their ids, numbers, statuses and journal links; journals are not touched (rule 3). Old tables are dropped in the same migration after row-count and totals checks inside the migration (it aborts if they differ). Existing invoice numbers stay.
- **Tests:** status machine unit tests (every illegal transition), calculation parity (old invoice/bill totals = new engine totals for all fixtures), migration test on a copy of the demo data, all existing invoice/bill/AI e2e suites pass unchanged against the new tables.
- **Done when:** invoices and bills are rows of one table built by one engine; old services are gone; every existing test passes.

---

## d) Stage 2 – Sales invoices and supplier bills on the shared model (`feature/invoices-and-bills`)
**Invoices**
- Number allocated **at approval** (drafts show "Draft"); gap-free per organisation and year; voided invoices keep their number.
- Lines with account and tax code (contact default pre-fills).
- Approval posts Dr debtors control (contact override or AR) / Cr revenue per line / Cr VAT control, tax-analysed, through the posting engine. Approved invoices are immutable: changes only by credit note (Stage 4) or void-by-reversal while unpaid.
- **VAT invoice PDF** (`GET /invoices/:id/pdf`) with all HMRC-required fields: unique number, issue date, tax point if different, our name/address/VAT number, customer name/address, description, quantity, unit price ex VAT, rate per line, net per rate, total VAT (in GBP), total; reverse-charge wording when a reverse-charge code is used. Generated from posted data only; stored as an attachment at approval so the PDF never changes.
- **AI:** a SALE document approved in review becomes a draft invoice (exists) — now with `contact_reference` and attachment.

**Bills**
- Behaviour from plan.md Stage 11 moved onto the shared engine: supplier invoice number + internal number, duplicate check (same supplier + supplier number, case-insensitive) with logged override, Dr expense/asset / Dr VAT input / Cr creditors, attachment.
- **AI:** unchanged flow, now producing a shared-model draft bill.
- **Tests:** invoice approval numbering under concurrency (two approvals, no gap/duplicate), PDF contains every required field (text extraction of the PDF), immutability (409 on edit after approval), bill duplicate/override, journal shape, **trial balance still balances**, VAT boxes move as expected; all AI e2e suites (incl. the 10-document Stage 13 suite) still pass.
- **Done when:** both document types are created, approved, posted, voided and printed through the shared engine, and the old per-type code is gone.

---

## e) Stage 3 – Customer and supplier payments, one allocation engine (`feature/payments`)
- `payments`: kind (CUSTOMER_RECEIPT / SUPPLIER_PAYMENT / CUSTOMER_REFUND / SUPPLIER_REFUND), contact, bank account (ASSET BANK/CASH), date, amount, reference, journal, status (POSTED / VOIDED).
- **One allocation engine** `src/allocations/`: allocate a payment (or credit note, or customer credit) across one or more open documents of the right side; partial allowed; never more than the document balance; total allocated ≤ payment amount. Locks the documents (`FOR UPDATE`) to stop double allocation. Updates derived status PAID/PARTIALLY_PAID.
- **Customer receipt:** Dr bank / Cr debtors control, contact-tagged. **Overpayment** stays as unallocated customer credit (a credit balance on debtors for that contact), allocatable later or refundable.
- **Supplier payment:** Dr creditors / Cr bank. "Bills to pay" list by due date with totals; **batch payment**: one payment per supplier from one bank account in one transaction (all or nothing), plus a CSV export of the batch for upload to the bank (no bank API).
- Voiding a payment reverses its journal and its allocations.
- Cash-accounting VAT (Stage 0) now reads these allocations.
- **AI:** remittance advice / receipt documents are out of scope for posting; the AI may **suggest** which open invoices a receipt pays (exact amount and reference match first, by code; model only ranks remaining candidates). The user confirms every allocation.
- **Tests:** allocation unit tests (partial, over-allocation refused, concurrent allocation), receipt/payment e2e with **trial balance still balances**, overpayment → credit → later allocation, batch all-or-nothing on failure, cash-accounting return after payments.
- **Done when:** documents can be part-paid and fully paid on both sides from one engine, statuses follow allocations, and debtors/creditors per contact equal open balances.

## f) Stage 4 – Credit notes & refunds, expenses & receipts (`feature/credit-notes-expenses`)
**Credit notes** (kinds SALES_CREDIT_NOTE / SUPPLIER_CREDIT_NOTE in the shared table)
- Standalone or from an invoice/bill (copies lines; full or partial, never more than the original's remaining creditable amount per line).
- Journal mirrors the original (Dr revenue / Dr VAT / Cr debtors), negative tax-analysed amounts so VAT boxes reduce correctly.
- Allocate to open invoices of the same contact (allocation engine), or **refund** (payment kind CUSTOMER_REFUND: Dr debtors / Cr bank). Supplier credit notes mirror this.
- **AI:** documents classified `SALES_CREDIT_NOTE` / `PURCHASE_CREDIT_NOTE` become draft credit notes in review, linked to the original when its number is printed and matches exactly; otherwise standalone.

**Expenses**
- `expenses` (+ lines on the shared line structure): **business-paid** (Cr bank) or **employee-paid** (Cr "Expense claims" liability account per employee member; repaid later by a supplier-style payment to the claimant).
- **Mileage**: configurable rate table per organisation (default the HMRC 45p/25p values entered as data with dates, editable), miles × rate, no VAT reclaim by default (fuel-element VAT out of scope for now).
- Receipt attachment required above a configurable amount.
- Approval posts through the posting engine with tax analysis.
- **AI:** `RECEIPT` / `EXPENSE_RECEIPT` documents become draft expenses in the same review screen (merchant, date, total, VAT if printed; payment method chosen by the user, never guessed).
- **Tests:** credit note VAT negation and box movement, partial credit limits, refund journal, expense both paths, mileage calculation, claim repayment; **trial balance still balances** everywhere.
- **Done when:** both flows post correctly, allocate/refund, and AI drafts land in review.

## g) Stage 5 – Accounts receivable and payable (`feature/ar-ap`)
- **Aged debtors / aged creditors** at any date, by contact: current, 1–30, 31–60, 61–90, 90+ days overdue (by due date), as at the date (documents and allocations dated after it ignored). Unallocated credits shown separately. CSV export. Web pages at the existing nav links.
- **Reconciliation check:** sum of open invoice balances (minus unallocated customer credits) = debtors control account balance at the date; same for creditors. Shown as a status on the report; **automated e2e test asserts it** after a mixed scenario (invoices, part payments, credit notes, overpayment, void).
- **Tests:** bucket boundaries (exactly 30/31 days), as-at dates in the past, reconciliation test.
- **Done when:** both reports match the control accounts and the test is in the suite.

## h) Common to every stage
Branch `feature/<stage>`, tests first where practical, full suite green (unit + e2e + web), anything that posts has a "trial balance still balances" check, plan updated, checkpoint. Tenant scoping on every query; money in `Prisma.Decimal`; posted records immutable; AI creates drafts only.

## i) Open questions
1. **Shared model: one table or shared code?** I recommend one `commercial_documents` table (migrating existing invoices and bills, ids and numbers kept, journals untouched). The alternative is keeping two tables and sharing only the engine code: less migration risk, but the schema stays duplicated. Which?
2. **Invoice numbering at approval** changes current behaviour: existing drafts lose their pre-allocated numbers (posted ones keep theirs). OK?
3. **PDF library:** add `pdfkit` (small, no browser) to the API for invoice PDFs? Alternative: HTML → PDF with a headless browser (heavier).
4. **VAT schemes (Stage 0):** build cash accounting and Flat Rate fully now, or only the setting plus STANDARD/NOT_REGISTERED now and the two schemes after Stage 3 (cash accounting needs payments anyway)? I recommend: setting + FRS in Stage 0, cash accounting completed in Stage 3.
5. **Multi-currency:** keep base currency only (as today) for all of this? I recommend yes; foreign currency is a separate stage.
6. **Batch supplier payments:** a CSV export of the batch is enough for now (no bank API, no BACS file format)?
7. **Mileage rates:** seed HMRC 45p (first 10,000 miles) / 25p as editable dated data per organisation?
8. **AI scope:** as above — credit notes and expense receipts become drafts via the existing review screen; payment-allocation *suggestions* only (user confirms). Anything more you want the AI to do here?

---

## Build log

### Stage 0 – VAT schemes: done (branch `feature/vat-schemes`)
- `organization_vat_schemes` (migration `20261017100000_vat_schemes`): dated rows (scheme, start date, flat-rate %, limited cost trader); a row applies until the next one. No row = STANDARD. DB check: flat-rate % only (and required) for FLAT_RATE. The AI business profile's `vat_scheme` column moved here (Flat Rate rows without a % can't be carried over and are dropped) and the profile now reads the dated setting; `PUT /ai/business-profile` no longer accepts `vatScheme` (400).
- API: `GET/PUT /organizations/:orgId/vat-scheme` (`organization.view` / `organization.edit`, audited `VAT_SCHEME_CHANGED`). **Forward-only:** the start date must be after the last change and after every posted VAT-analysed journal (409 `VAT_SCHEME_BACKDATED`), so prepared returns never change. Flat rate 0.01–16.5%; limited cost trader requires 16.5% (the user's own determination).
- VAT return: the scheme for the whole period decides the method. A period that straddles a change → 422 `VAT_SCHEME_CHANGED_IN_PERIOD`. STANDARD and ANNUAL_ACCOUNTING use the existing invoice-basis boxes. **FLAT_RATE** (`flatRateBoxes` in `src/tax/vat-schemes.ts`): box 6 = VAT-inclusive turnover (incl. zero-rated/exempt, excl. outside scope), box 1 = % × turnover + self-accounted VAT (reverse charge / PIVA), box 4/7 = capital assets (FIXED_ASSET accounts) bought on one journal totalling ≥ £2,000 incl. VAT. NOT_REGISTERED → 422 `VAT_NOT_REGISTERED`. CASH_ACCOUNTING → 422 `VAT_SCHEME_NOT_SUPPORTED` until payments exist (Stage 3). Box drill-down is refused for Flat Rate.
- **Flat-rate adjustment** `POST /vat-return/flat-rate-adjustment {from,to}` (`vat_return.view` + `journal.post`): posts the difference between the VAT control movement and box 5 against the first OTHER_INCOME account (TAX journal, SYSTEM source, through the posting engine), once per period (409 if already posted; reverse to redo). Afterwards the return reconciles.
- **Not registered:** new posting-engine Rule 16 – on a date the organisation is NOT_REGISTERED, any tax code other than outside the scope is refused (`VAT_NOT_REGISTERED`), for invoices, bills and anything else that posts. Reversals are unaffected.
- Web: Settings → Taxes (`/settings/taxes`): current scheme, change form (scheme, date, flat %, LCT), history.
- Tests: `vat-schemes.spec.ts` (Flat Rate boxes: turnover incl. zero/exempt, £2,000 threshold incl. exactly £2,000, reverse charge, credit notes, outside scope); `test/vat-schemes.e2e-spec.ts` (fresh organisation: default standard, standard return, validation, Flat Rate return with exact boxes, straddle refused, adjustment journal balanced + **trial balance still balances** + return reconciles + only once, not-registered refusal at posting for invoices and bills, cash accounting refused). Full suite: 385 unit, 182 e2e, 6 web.
- Deferred: cash-accounting boxes (Stage 3, needs allocations); the Flat Rate first-year 1% discount is entered by the user as a lower rate (no automatic switch after a year); FRS treatment of reverse charge follows HMRC 733 as box 1 only (no reclaim unless a capital asset) – worth confirming with an accountant.
