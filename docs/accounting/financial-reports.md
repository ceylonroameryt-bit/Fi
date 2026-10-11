# Financial Reports

## General requirements
Every report must define its organisation, currency, date basis, range, filters, and source of truth. Use the posted ledger as the authoritative source for accounting balances unless a report explicitly documents another basis.

## Trial balance
The trial balance lists account balances for a selected date or period. Debit and credit totals should agree for the same included ledger population. Define whether the report includes inactive accounts, opening balances, year-end entries, and zero balances.

## Profit and loss
The profit and loss report aggregates revenue and expense accounts for a clearly defined date range. Specify treatment of prior-period entries, year-end closing, contra accounts, and any tax presentation.

## Balance sheet
The balance sheet presents assets, liabilities, and equity as at a specified date. Under the defined accounting model, total assets should equal liabilities plus equity. Define how current-year profit, retained earnings, opening balances, and closing entries are represented.

## General ledger
A general-ledger view should identify account, date, journal reference, description, debit, credit, running balance, and any source-document link that exists. Ordering must be deterministic, including a stable tie-breaker for entries on the same date.

## Calculation and security rules
- Use decimal-safe arithmetic and one documented rounding policy.
- Apply organisation and permission filters in the server-side query.
- Prevent date/time-zone ambiguity at range boundaries.
- Do not double-count reversals or commercial documents and their generated journals.
- Paginate large datasets and use stable sorting.
- CSV exports must neutralise spreadsheet formula injection and correctly escape delimiters, quotes, and newlines.
- Never expose another tenant's identifiers or data through totals, error messages, or export metadata.

## Reconciliation tests
Use a hand-calculated fixture with opening balances, several balanced journals, revenue/expense activity, and a reversal. Assert per-account balances, total debits/credits, P&L result, balance-sheet equation, and the effect of date filters. Keep expected values independent of the production calculation code.
