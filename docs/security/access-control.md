# Access Control

## Roles described by the repository README
| Role | Intended responsibility |
|---|---|
| OWNER | Full organisation administration and ledger privileges, including organisation lifecycle actions. |
| ADMINISTRATOR | Operational administration, user management, and permitted period-unlock actions. |
| ACCOUNTANT | Ledger operations, journal validation, and period review/locking. |
| BOOKKEEPER | Prepare drafts and view permitted accounting records. |
| VIEWER | Read-only access to permitted accounts, journals, and reports. |

This table records the documented role intent. The actual permission-to-route matrix must be extracted from current code and tested before production use.

## Authorisation rules
- Deny by default.
- Authentication answers who the caller is; authorisation answers what they may do.
- Enforce permissions on the server for every endpoint and object.
- Verify organisation membership before reading or changing tenant-owned records.
- Do not rely on hidden UI controls as access control.
- Use least privilege for runtime, migration, support, and CI identities.
- Treat role changes, member removal, organisation switching, period unlocking, posting, and reversal as auditable events.
- Verify that changing IDs in path, query, body, or headers cannot bypass scope checks.

## Required permission matrix
Maintain a checked-in matrix with rows for every API action and columns for each role. Include the default deny rule, tenant scope, and whether an action needs step-up confirmation. Link each cell or grouped rule to automated tests.
