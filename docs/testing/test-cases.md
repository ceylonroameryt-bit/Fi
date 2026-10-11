# Core Test Case Catalogue

These cases define expected coverage. Map them to actual automated test names as implementation is audited.

## Journals and posting
| ID | Scenario | Expected result |
|---|---|---|
| TC-ACC-001 | Balanced journal with valid accounts and open period | Validation succeeds. |
| TC-ACC-002 | Debits and credits differ | Validation/posting rejected; no ledger effect. |
| TC-ACC-003 | Fewer than two lines | Rejected for posting. |
| TC-ACC-004 | Negative amount, both sides positive, or both sides zero | Rejected. |
| TC-ACC-005 | Account belongs to another organisation | Rejected without leaking cross-tenant data. |
| TC-ACC-006 | Inactive or ineligible account | Rejected according to documented policy. |
| TC-ACC-007 | Period hard-locked after validation but before posting | Posting rejected inside the authoritative transaction. |
| TC-ACC-008 | Two concurrent requests post the same journal | Exactly one financial effect occurs. |
| TC-ACC-009 | Failure occurs midway through posting | Transaction leaves no partial effect. |
| TC-ACC-010 | Edit a validated draft | Validation is invalidated and must be repeated. |
| TC-ACC-011 | Attempt to edit/delete a posted journal | Denied; history remains intact. |
| TC-ACC-012 | Reverse a posted journal | Correct linked offset is recorded and audited. |

## Identity, tenancy, and permissions
| ID | Scenario | Expected result |
|---|---|---|
| TC-SEC-001 | Unauthenticated request to protected endpoint | Denied. |
| TC-SEC-002 | Expired or revoked session | Denied. |
| TC-SEC-003 | Viewer calls a write endpoint directly | Denied server-side. |
| TC-SEC-004 | User changes organisation/record ID to another tenant | Denied with no data leakage. |
| TC-SEC-005 | Removed member reuses an old session | Access follows the documented immediate-revocation policy. |
| TC-SEC-006 | Role is downgraded while a session is active | New requests enforce the current permission policy. |

## Database and reports
| ID | Scenario | Expected result |
|---|---|---|
| TC-DB-001 | Duplicate organisation-scoped account code | Database/service rejects it. |
| TC-DB-002 | Overlapping financial periods | Rejected. |
| TC-REP-001 | Trial balance for known ledger fixture | Per-account balances and debit/credit totals match expected values. |
| TC-REP-002 | P&L and balance sheet for same fixture | Totals reconcile with ledger and accounting equation. |
| TC-REP-003 | Reversal and date filter | Original/reversal appear in correct ranges without double-counting. |
| TC-REP-004 | CSV fields begin with spreadsheet formula characters | Export neutralises formula execution and preserves intended data. |

## Operations
| ID | Scenario | Expected result |
|---|---|---|
| TC-OPS-001 | Install and run from clean checkout | Documented setup succeeds. |
| TC-OPS-002 | Migration from prior supported schema | Data and constraints remain valid. |
| TC-OPS-003 | Restore from backup | Application starts and accounting reconciliation passes. |
| TC-OPS-004 | Production configuration has missing required secret | Deployment/startup fails safely with no secret disclosure. |

For each case, record the automated test location, fixture, result, commit, environment, and date. Do not mark a case passed based only on code inspection.
