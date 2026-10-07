# Multi-Tenant Isolation & Subledger Security

## Architectural Overview

Blynt enforces strict multi-tenant isolation across all data access patterns and subledger accounting workflows. Tenant boundaries are enforced through a defense-in-depth model combining application-layer scoping and database-level composite foreign key constraints.

## Defense-in-Depth Model

### 1. Database-Level Foreign Key Hardening
Single-column foreign keys (`contact_id` pointing to `contacts.id`) are insufficient for multi-tenant systems because they cannot prevent a record in Organisation A from referencing an ID belonging to Organisation B if IDs are forged or leaked.

Blynt resolves this by enforcing composite foreign keys containing `organization_id`:

```sql
ALTER TABLE "journal_lines" 
ADD CONSTRAINT "journal_lines_organization_id_contact_id_fkey" 
FOREIGN KEY ("organization_id", "contact_id") 
REFERENCES "contacts"("organization_id", "id") 
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contact_people" 
ADD CONSTRAINT "contact_people_organization_id_contact_id_fkey" 
FOREIGN KEY ("organization_id", "contact_id") 
REFERENCES "contacts"("organization_id", "id") 
ON DELETE CASCADE ON UPDATE CASCADE;
```

If an application bug or malicious payload attempts to associate a journal line or contact person in Organisation A with a Contact in Organisation B, PostgreSQL rejects the transaction immediately at the engine level with foreign key violation code `23503`.

### 2. Application Scoping
All queries and mutations in `ContactsService`, `ContactSubledgerService`, and `InvoicesService` mandate the active user's `organizationId` in every query predicate (`where: { organizationId, ... }`).
