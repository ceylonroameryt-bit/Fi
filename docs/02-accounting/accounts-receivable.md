# Accounts Receivable (AR) Subledger

## Overview

Accounts Receivable represents the money owed to an organisation by its customers for goods or services delivered on credit. In Blynt, Accounts Receivable operates as a subledger governed strictly by double-entry General Ledger journals.

## Double-Entry Posting Rules

When a Sales Invoice is posted to the General Ledger:

```
DR 1100 Accounts Receivable      [contactId: customerId]
   CR 4000 Sales Revenue         [contactId: null]
   CR 2100 VAT Output Tax        [contactId: null]
```

### Critical Subledger Rule
The debit to `1100 Accounts Receivable` **must** be tagged with `contactId = invoice.contactId`. The revenue and tax lines remain at the general ledger level without individual customer subledger tags.

## Customer Balance Derivation

Customer balance is **never** maintained as a mutable column on the contact record. It is calculated dynamically from financially effective (`POSTED`) journal lines:

$$\text{Customer Balance} = \sum (\text{AR Debits}) - \sum (\text{AR Credits})$$

Only journal lines meeting the following conditions are included:
1. `journal.status == POSTED`
2. `journalLine.contactId == targetCustomerId`
3. `journalLine.account.accountSubtype == ACCOUNTS_RECEIVABLE` (or configured AR account)
4. `journal.organizationId == targetOrganizationId`

## Invoice Voiding & Reversal

When a posted sales invoice is voided:
1. A reversal journal entry is created with reversed debits and credits.
2. The reversal journal line for the AR account explicitly preserves the `contactId`.
3. The resulting AR credit offsets the original AR debit in the customer subledger, naturally returning the customer balance to £0.00 without manual balance adjustments.

## Customer Statements

Customer statements are generated on demand (`GET /contacts/:id/statement`):
1. **Opening Balance**: Net debits minus credits before the statement start date (`from`).
2. **Statement Items**: Chronologically ordered journal lines between `from` and `to`, with `date`, `reference`, `sourceType`, `description`, `debit`, `credit`, and continuous `runningBalance`.
3. **Closing Balance**: Opening balance plus period debits minus period credits.
