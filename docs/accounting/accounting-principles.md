# Accounting Principles and Invariants

This document defines engineering guardrails. It is not a substitute for professional accounting advice or a complete statement of applicable accounting standards.

## Double-entry invariant
For each journal accepted for posting, total debits must equal total credits at the precision defined by the accounting model. Use decimal arithmetic and a consistent rounding policy. Never rely on floating-point comparisons.

## Account balances
The normal-balance conventions described in the README are:
- Assets: debit
- Expenses: debit
- Liabilities: credit
- Equity: credit
- Revenue: credit

Contra accounts and special account subtypes may require presentation rules. Document each exception explicitly.

## Journal rules
- A journal contains at least two lines.
- Each line has a strictly non-negative debit and credit and exactly one side greater than zero.
- All referenced accounts belong to the same organisation and are eligible for the operation.
- The journal date resolves to a valid period in that organisation.
- Hard-locked periods reject prohibited changes.
- Drafts can be edited subject to permissions and validation.
- Posting is a controlled, atomic state transition.
- Posted financial facts are not silently overwritten; corrections use explicit, linked reversals and replacement entries.
- Every financial state transition is attributable and auditable.

## Posting transaction
The database transaction should encompass all writes needed to make the financial effect visible consistently, including the state transition, sequence/idempotency controls, and audit event as designed. A failed operation must leave no partial ledger effect.

## Reports
- Trial balance debit and credit totals should agree for the same ledger population and reporting basis.
- Balance sheet assets should equal liabilities plus equity when the accounting model and period-close treatment are correct.
- Profit and loss must use a defined reporting range and revenue/expense classification.
- Reversals, opening balances, year-end closing, tax treatment, and inactive accounts must have documented semantics.
- CSV output must escape values and guard against spreadsheet formula injection.

## Open accounting decisions
Record the chosen currency scale, rounding method, tax/VAT model, year-end process, opening-balance import, multi-currency support, and report basis in the decision log before implementing them.
