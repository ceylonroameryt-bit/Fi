# Phase 3: Contacts V2 & Subledger Foundation

## 1. Executive Summary

Phase 3 transitions Blynt's Contacts module from a passive directory into an authoritative **accounting subledger foundation**. In standard double-entry bookkeeping, accounts receivable (AR) and accounts payable (AP) represent control accounts on the General Ledger. The individual breakdown per customer or supplier must be tracked strictly through subledger journal entries without relying on mutable or cached balance fields.

This implementation establishes:
- Tenant-safe composite relations between `JournalLine` and `Contact` `(organization_id, contact_id)` with `onDelete: Restrict`.
- Automatic tagging of the AR control line with `contactId` during sales invoice posting.
- Offsetting subledger tags during invoice reversals/voids.
- Real-time derived subledger balances (`getCustomerBalance`, `getSupplierBalance`, `getContactBalance`) using high-precision decimal arithmetic (`Prisma.Decimal`).
- Authoritative customer/supplier statements with opening balance, chronologically sorted journal line debits/credits, running balance, and closing balance.
- Multiple contact persons per business entity via the `ContactPerson` model.
- Server-side pagination, sorting whitelists, debounced search, duplicate detection heuristics, and KPI summaries.

---

## 2. Contact & Subledger Flow Architecture

The diagram below outlines how transactions flow from a contact through the posting engine into the subledger, general ledger, balance, and customer statements:

```mermaid
flowchart TD
    C[Contact: Customer / Supplier / Both] --> I[Sales Invoice / Bill]
    I --> PE[Accounting Posting Engine]
    PE --> GL[General Ledger Journal]
    
    subgraph Double-Entry Posting
        GL --> JL1["DR 1100 Accounts Receivable<br/>(Tagged with contactId)"]
        GL --> JL2["CR 4000 Sales Revenue<br/>(No contactId required)"]
        GL --> JL3["CR 2100 VAT Output Tax<br/>(No contactId required)"]
    end
    
    JL1 --> CSL[Customer Subledger]
    CSL --> BAL[Customer Balance<br/>SUM(Posted AR Debits - Credits)]
    CSL --> STM[Customer Statement<br/>Chronological Activity & Running Balance]
    CSL --> AGE[AR Ageing Analysis]
    
    subgraph Future Payments Phase
        PAY[Customer Payment Receipt] --> PENG[Posting Engine]
        PENG --> PJL1["DR 1000 Bank / Cash"]
        PENG --> PJL2["CR 1100 Accounts Receivable<br/>(Tagged with contactId)"]
        PJL2 --> CSL
    end
```

---

## 3. Core Architectural Rules

### 3.1 Non-Negotiable Accounting Rule: No Cached Balances
In accordance with professional accounting engine design:
- Contact balances are **never** stored as numeric columns (`balance`, `outstandingAmount`, etc.) on the `contacts` table.
- Balances are derived dynamically from **POSTED** journal lines on designated control accounts (`ACCOUNTS_RECEIVABLE` for customers, `ACCOUNTS_PAYABLE` for suppliers).
- When an invoice is voided or reversed, offsetting reversal journal lines preserve the `contactId` tag on the control account lines, naturally returning the subledger balance to zero.

### 3.2 Tenant Isolation & Database Integrity
Cross-tenant contamination is structurally impossible at the database level:
- Composite foreign keys enforce that a `JournalLine` in organisation $A$ can only reference a `Contact` with the exact same `organization_id`:
  ```sql
  CONSTRAINT "journal_lines_organization_id_contact_id_fkey" 
  FOREIGN KEY ("organization_id", "contact_id") 
  REFERENCES "contacts"("organization_id", "id") 
  ON DELETE RESTRICT ON UPDATE CASCADE
  ```
- Similarly, child records (`ContactPerson`) enforce composite tenant safety:
  ```sql
  CONSTRAINT "contact_people_organization_id_contact_id_fkey" 
  FOREIGN KEY ("organization_id", "contact_id") 
  REFERENCES "contacts"("organization_id", "id") 
  ON DELETE CASCADE ON UPDATE CASCADE
  ```

---

## 4. Key Endpoints Implemented

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/contacts` | Server-paginated, filtered, sorted contact list |
| `GET` | `/contacts/summary` | Global organisation KPI card summary (total, active, archived, etc.) |
| `GET` | `/contacts/duplicate-check` | Heuristic match warnings (email, VAT, company number, company+postcode) |
| `GET` | `/contacts/:id` | Full contact details with primary person, people list, and counts |
| `POST` | `/contacts` | Create contact with hardened AR/AP account validation |
| `PATCH` | `/contacts/:id` | Update contact metadata, accounts, and addresses |
| `POST` | `/contacts/:id/archive` | Archive contact (blocks new transactions, preserves history) |
| `POST` | `/contacts/:id/restore` | Restore archived contact to active status |
| `GET` | `/contacts/:id/statement` | Ledger-derived statement with running balance |
| `GET` | `/contacts/:id/activity` | Paginated activity timeline across invoices and journals |
| `GET` | `/contacts/:id/people` | Retrieve contact people for a contact |
| `POST` | `/contacts/:id/people` | Create a contact person |
| `PATCH` | `/contacts/:id/people/:personId` | Update a contact person |
| `POST` | `/contacts/:id/people/:personId/primary` | Set designated primary contact person |
| `DELETE` | `/contacts/:id/people/:personId` | Soft-deactivate a contact person |
